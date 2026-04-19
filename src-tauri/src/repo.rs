use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

pub const CATEGORIES: &[&str] = &["Rani", "CodeCrew", "KRN", "Fordevo", "ByTaika"];

pub fn account_for(category: &str) -> &'static str {
    match category {
        "Rani" => "rani",
        _ => "personal",
    }
}

pub fn base_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join("ProjectBase")
}

pub fn repo_path_for(category: &str, sub: Option<&str>, name: &str) -> PathBuf {
    let mut p = base_dir().join(category);
    if let Some(s) = sub {
        if !s.is_empty() {
            p = p.join(s);
        }
    }
    p.join(name)
}

pub fn is_valid_category(cat: &str) -> bool {
    CATEGORIES.iter().any(|c| *c == cat)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LastCommit {
    pub hash: String,
    pub short: String,
    pub subject: String,
    pub author: String,
    pub relative_time: String,
    pub timestamp: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub id: String,
    pub category: String,
    pub sub_category: Option<String>,
    pub name: String,
    pub path: String,
    pub account: String,
    pub branch: Option<String>,
    pub dirty: usize,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit: Option<LastCommit>,
    pub remote: Option<String>,
    pub owner: Option<String>,
    pub repo_name: Option<String>,
    pub has_upstream: bool,
}

pub async fn git(cwd: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(cwd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim_end().to_string(),
        Err(_) => String::new(),
    }
}

fn parse_github_remote(url: &str) -> Option<(String, String)> {
    let re = regex::Regex::new(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$").ok()?;
    let cap = re.captures(url)?;
    Some((cap[1].to_string(), cap[2].to_string()))
}

fn is_git_repo(p: &Path) -> bool {
    p.join(".git").exists()
}

pub async fn get_repo_info(
    category: &str,
    sub: Option<&str>,
    name: &str,
    repo_path: &Path,
) -> RepoInfo {
    let (branch, status, ahead_behind, last_raw, remote) = tokio::join!(
        git(repo_path, &["branch", "--show-current"]),
        git(repo_path, &["status", "--porcelain"]),
        git(repo_path, &["rev-list", "--left-right", "--count", "@{u}...HEAD"]),
        git(repo_path, &["log", "-1", "--pretty=format:%H\x1f%h\x1f%s\x1f%an\x1f%cr\x1f%ct"]),
        git(repo_path, &["config", "--get", "remote.origin.url"]),
    );

    let dirty = if status.is_empty() {
        0
    } else {
        status.lines().filter(|l| !l.is_empty()).count()
    };

    let (ahead, behind, has_upstream) = if ahead_behind.is_empty() {
        (0u32, 0u32, false)
    } else {
        let parts: Vec<&str> = ahead_behind.split_whitespace().collect();
        if parts.len() == 2 {
            let b = parts[0].parse().unwrap_or(0);
            let a = parts[1].parse().unwrap_or(0);
            (a, b, true)
        } else {
            (0, 0, false)
        }
    };

    let last_commit = if last_raw.is_empty() {
        None
    } else {
        let parts: Vec<&str> = last_raw.split('\x1f').collect();
        if parts.len() >= 6 {
            Some(LastCommit {
                hash: parts[0].into(),
                short: parts[1].into(),
                subject: parts[2].into(),
                author: parts[3].into(),
                relative_time: parts[4].into(),
                timestamp: parts[5].parse().unwrap_or(0),
            })
        } else {
            None
        }
    };

    let gh = if remote.is_empty() { None } else { parse_github_remote(&remote) };
    let id = match sub {
        Some(s) if !s.is_empty() => format!("{}/{}/{}", category, s, name),
        _ => format!("{}/{}", category, name),
    };

    RepoInfo {
        id,
        category: category.into(),
        sub_category: sub.map(|s| s.to_string()).filter(|s| !s.is_empty()),
        name: name.into(),
        path: repo_path.to_string_lossy().to_string(),
        account: account_for(category).into(),
        branch: if branch.is_empty() { None } else { Some(branch) },
        dirty,
        ahead,
        behind,
        last_commit,
        remote: if remote.is_empty() { None } else { Some(remote) },
        owner: gh.as_ref().map(|(o, _)| o.clone()),
        repo_name: gh.as_ref().map(|(_, r)| r.clone()),
        has_upstream,
    }
}

pub async fn list_category_repos(category: &str) -> Vec<RepoInfo> {
    let cat_dir = base_dir().join(category);
    let Ok(mut rd) = tokio::fs::read_dir(&cat_dir).await else {
        return Vec::new();
    };

    let mut tasks = Vec::new();
    while let Ok(Some(entry)) = rd.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        let Ok(meta) = entry.metadata().await else { continue };
        if !meta.is_dir() {
            continue;
        }

        let category = category.to_string();
        tasks.push(tokio::spawn(async move {
            let mut infos: Vec<RepoInfo> = Vec::new();
            // Case 1: entry itself is a repo
            if is_git_repo(&path) {
                infos.push(
                    get_repo_info(&category, None, &name, &path).await,
                );
                return infos;
            }
            // Case 2: walk one level deeper — treat entry as a sub-category folder
            if let Ok(mut sub_rd) = tokio::fs::read_dir(&path).await {
                while let Ok(Some(sub_entry)) = sub_rd.next_entry().await {
                    let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                    if sub_name.starts_with('.') {
                        continue;
                    }
                    let sub_path = sub_entry.path();
                    let Ok(sub_meta) = sub_entry.metadata().await else { continue };
                    if !sub_meta.is_dir() {
                        continue;
                    }
                    if is_git_repo(&sub_path) {
                        infos.push(
                            get_repo_info(&category, Some(&name), &sub_name, &sub_path).await,
                        );
                    }
                }
            }
            infos
        }));
    }

    let mut all: Vec<RepoInfo> = Vec::new();
    for t in tasks {
        if let Ok(infos) = t.await {
            all.extend(infos);
        }
    }
    all.sort_by(|a, b| {
        let sub_a = a.sub_category.as_deref().unwrap_or("");
        let sub_b = b.sub_category.as_deref().unwrap_or("");
        sub_a.cmp(sub_b).then_with(|| a.name.cmp(&b.name))
    });
    all
}

pub async fn list_all_repos() -> std::collections::BTreeMap<String, Vec<RepoInfo>> {
    let mut tasks = Vec::new();
    for cat in CATEGORIES {
        let c = cat.to_string();
        tasks.push(tokio::spawn(async move {
            let infos = list_category_repos(&c).await;
            (c, infos)
        }));
    }
    let mut map = std::collections::BTreeMap::new();
    for t in tasks {
        if let Ok((c, infos)) = t.await {
            map.insert(c, infos);
        }
    }
    map
}

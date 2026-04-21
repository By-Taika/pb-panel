use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::config::{CategoryConfig, Config};

pub fn base_dir_from(cfg: &Config) -> PathBuf {
    PathBuf::from(&cfg.base_dir)
}

pub fn account_id_for(cfg: &Config, category: &str) -> Option<String> {
    cfg.categories
        .iter()
        .find(|c| c.name == category)
        .map(|c| c.account_id.clone())
}

pub fn find_category<'a>(cfg: &'a Config, name: &str) -> Option<&'a CategoryConfig> {
    cfg.categories.iter().find(|c| c.name == name)
}

pub fn repo_path_for(cfg: &Config, category: &str, sub: Option<&str>, name: &str) -> PathBuf {
    let mut p = base_dir_from(cfg).join(category);
    if let Some(s) = sub {
        if !s.is_empty() {
            p = p.join(s);
        }
    }
    p.join(name)
}

pub fn is_valid_category(cfg: &Config, cat: &str) -> bool {
    cfg.categories.iter().any(|c| c.name == cat)
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
    /// Account id (matches Config.accounts[].id), or empty if the category has
    /// no account mapping.
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
    /// Number of branches whose remote SHA differs from the last cached
    /// remote-tracking ref — i.e. pushes that happened since the last local
    /// fetch. Zero means up-to-date, `None` means the check was skipped or
    /// failed (no remote / offline / auth issue).
    pub remote_updates: Option<u32>,
    /// Names of the branches flagged above. Useful as a tooltip in the UI.
    pub updated_branches: Vec<String>,
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

/// Check whether the remote has any branches with commits newer than what's
/// cached locally in `refs/remotes/origin/*`. Uses `ls-remote` (metadata only —
/// no objects downloaded), so it's much cheaper than a full fetch.
///
/// Returns `(count, branch_names)`. If the check fails (no remote, offline,
/// auth prompt) returns `None` so the UI can distinguish "up to date" from
/// "couldn't check".
async fn check_remote_updates(repo_path: &Path) -> Option<(u32, Vec<String>)> {
    // Force non-interactive: if creds aren't cached we'd rather fail than
    // hang the panel on a password prompt.
    let ls = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["ls-remote", "--heads", "origin"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "/usr/bin/true")
        .env("SSH_ASKPASS", "/usr/bin/true")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .ok()?;
    if !ls.status.success() {
        return None;
    }
    let ls_text = String::from_utf8_lossy(&ls.stdout);

    let mut remote: HashMap<String, String> = HashMap::new();
    for line in ls_text.lines() {
        let mut parts = line.split_whitespace();
        let sha = parts.next()?.to_string();
        let refname = parts.next()?;
        if let Some(branch) = refname.strip_prefix("refs/heads/") {
            remote.insert(branch.to_string(), sha);
        }
    }
    if remote.is_empty() {
        return Some((0, Vec::new()));
    }

    let cached = git(
        repo_path,
        &[
            "for-each-ref",
            "--format=%(refname)\x1f%(objectname)",
            "refs/remotes/origin/",
        ],
    )
    .await;
    let mut local: HashMap<String, String> = HashMap::new();
    for line in cached.lines() {
        let mut it = line.split('\x1f');
        let refname = it.next()?;
        let sha = it.next()?;
        if let Some(branch) = refname.strip_prefix("refs/remotes/origin/") {
            if branch == "HEAD" {
                continue;
            }
            local.insert(branch.to_string(), sha.to_string());
        }
    }

    let mut changed: Vec<String> = remote
        .iter()
        .filter(|(b, sha)| local.get(*b).map(|l| l != *sha).unwrap_or(true))
        .map(|(b, _)| b.clone())
        .collect();
    changed.sort();
    Some((changed.len() as u32, changed))
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
    cfg: &Config,
    category: &str,
    sub: Option<&str>,
    name: &str,
    repo_path: &Path,
) -> RepoInfo {
    let (branch, status, ahead_behind, last_raw, remote, remote_update_check) = tokio::join!(
        git(repo_path, &["branch", "--show-current"]),
        git(repo_path, &["status", "--porcelain"]),
        git(repo_path, &["rev-list", "--left-right", "--count", "@{u}...HEAD"]),
        git(repo_path, &["log", "-1", "--pretty=format:%H\x1f%h\x1f%s\x1f%an\x1f%cr\x1f%ct"]),
        git(repo_path, &["config", "--get", "remote.origin.url"]),
        check_remote_updates(repo_path),
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
        account: account_id_for(cfg, category).unwrap_or_default(),
        branch: if branch.is_empty() { None } else { Some(branch) },
        dirty,
        ahead,
        behind,
        last_commit,
        remote: if remote.is_empty() { None } else { Some(remote) },
        owner: gh.as_ref().map(|(o, _)| o.clone()),
        repo_name: gh.as_ref().map(|(_, r)| r.clone()),
        has_upstream,
        remote_updates: remote_update_check.as_ref().map(|(n, _)| *n),
        updated_branches: remote_update_check.map(|(_, b)| b).unwrap_or_default(),
    }
}

pub async fn list_category_repos(cfg: &Config, cat: &CategoryConfig) -> Vec<RepoInfo> {
    let cat_dir = base_dir_from(cfg).join(&cat.name);
    let Ok(mut rd) = tokio::fs::read_dir(&cat_dir).await else {
        return Vec::new();
    };

    let hide = cat.hide.clone();
    let cat_name = cat.name.clone();
    let nested = cat.nested;

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

        let cfg_clone = cfg.clone();
        let cat_name = cat_name.clone();
        let hide = hide.clone();
        tasks.push(tokio::spawn(async move {
            let mut infos: Vec<RepoInfo> = Vec::new();

            // Direct child repo
            if is_git_repo(&path) {
                if !hide.contains(&name) {
                    infos.push(
                        get_repo_info(&cfg_clone, &cat_name, None, &name, &path).await,
                    );
                }
                return infos;
            }

            // Sub-category descent (only if enabled on this category)
            if !nested {
                return infos;
            }
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
                    if is_git_repo(&sub_path) && !hide.contains(&sub_name) {
                        infos.push(
                            get_repo_info(&cfg_clone, &cat_name, Some(&name), &sub_name, &sub_path)
                                .await,
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

pub async fn list_all_repos(
    cfg: &Config,
) -> std::collections::BTreeMap<String, Vec<RepoInfo>> {
    let mut tasks = Vec::new();
    for cat in cfg.categories.iter().cloned() {
        let cfg_clone = cfg.clone();
        tasks.push(tokio::spawn(async move {
            let infos = list_category_repos(&cfg_clone, &cat).await;
            (cat.name, infos)
        }));
    }
    let mut map = std::collections::BTreeMap::new();
    for t in tasks {
        if let Ok((name, infos)) = t.await {
            map.insert(name, infos);
        }
    }
    map
}

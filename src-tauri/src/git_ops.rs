use std::path::Path;
use std::process::Stdio;

use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::config::{AccountConfig, Config};
use crate::repo::{base_dir_from, find_category, is_valid_category};
use crate::tokens::token_for;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActionResult {
    pub ok: bool,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

fn find_account<'a>(cfg: &'a Config, id: &str) -> Option<&'a AccountConfig> {
    cfg.accounts.iter().find(|a| a.id == id)
}

fn build_auth_url(
    owner: &str,
    repo: &str,
    account: &AccountConfig,
) -> Result<String, String> {
    let token = token_for(&account.id, account.env_var.as_deref()).ok_or_else(|| {
        format!(
            "Missing token for '{}'. Configure it in Settings → Accounts.",
            account.label
        )
    })?;
    let username = account.username.as_deref().unwrap_or("git");
    Ok(format!(
        "https://{}:{}@github.com/{}/{}.git",
        username, token, owner, repo
    ))
}

fn clean_url(owner: &str, repo: &str) -> String {
    format!("https://github.com/{}/{}.git", owner, repo)
}

async fn run_git(cwd: Option<&Path>, args: &[&str]) -> ActionResult {
    let mut cmd = Command::new("git");
    if let Some(p) = cwd {
        cmd.arg("-C").arg(p);
    }
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    match cmd.output().await {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            let combined = format!("{}{}", stdout, stderr).trim().to_string();
            ActionResult {
                ok: o.status.success(),
                output: sanitize_token(&combined),
                path: None,
            }
        }
        Err(e) => ActionResult {
            ok: false,
            output: sanitize_token(&e.to_string()),
            path: None,
        },
    }
}

fn sanitize_token(s: &str) -> String {
    let re = Regex::new(r"ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+").unwrap();
    re.replace_all(s, "***").to_string()
}

pub async fn pull(repo_path: &Path) -> ActionResult {
    run_git(Some(repo_path), &["pull", "--ff-only"]).await
}

pub async fn fetch(repo_path: &Path) -> ActionResult {
    run_git(Some(repo_path), &["fetch", "--all", "--prune"]).await
}

pub async fn push(repo_path: &Path) -> ActionResult {
    // Plain `git push` — pushes the current branch to its tracked upstream.
    // If there's no upstream yet, this fails with a clear error; the user
    // can then use the Branches tab to run `push -u origin <branch>`.
    run_git(Some(repo_path), &["push"]).await
}

pub async fn log_commits(repo_path: &Path, limit: u32) -> Vec<serde_json::Value> {
    let lim = limit.to_string();
    let out = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args([
            "log",
            "-n",
            &lim,
            "--pretty=format:%H\x1f%h\x1f%s\x1f%an\x1f%cr\x1f%ct",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;
    let Ok(out) = out else { return Vec::new() };
    let text = String::from_utf8_lossy(&out.stdout);
    text.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() < 6 {
                return None;
            }
            Some(serde_json::json!({
                "hash": parts[0],
                "short": parts[1],
                "subject": parts[2],
                "author": parts[3],
                "relativeTime": parts[4],
                "timestamp": parts[5].parse::<i64>().unwrap_or(0),
            }))
        })
        .collect()
}

pub async fn clone_repo(
    cfg: &Config,
    category: &str,
    sub_category: Option<&str>,
    owner_repo: &str,
    target_name: Option<&str>,
) -> ActionResult {
    if !is_valid_category(cfg, category) {
        return ActionResult {
            ok: false,
            output: format!("Invalid category: {}", category),
            path: None,
        };
    }

    let mut or = owner_repo.trim().to_string();
    or = or.trim_start_matches("git@github.com:").to_string();
    or = or.trim_start_matches("https://github.com/").to_string();
    if or.ends_with(".git") {
        or.truncate(or.len() - 4);
    }
    let parts: Vec<&str> = or.split('/').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return ActionResult {
            ok: false,
            output: format!("Cannot parse repo: {}", owner_repo),
            path: None,
        };
    }
    let owner = parts[0];
    let repo = parts[1];

    let cat_cfg = find_category(cfg, category);
    let Some(cat_cfg) = cat_cfg else {
        return ActionResult {
            ok: false,
            output: format!("Category not found: {}", category),
            path: None,
        };
    };
    let account = match find_account(cfg, &cat_cfg.account_id) {
        Some(a) => a,
        None => {
            return ActionResult {
                ok: false,
                output: format!(
                    "Category '{}' maps to unknown account '{}'",
                    category, cat_cfg.account_id
                ),
                path: None,
            }
        }
    };

    let auth_url = match build_auth_url(owner, repo, account) {
        Ok(u) => u,
        Err(e) => return ActionResult { ok: false, output: e, path: None },
    };

    let mut parent = base_dir_from(cfg).join(category);
    if let Some(s) = sub_category {
        if !s.trim().is_empty() {
            parent = parent.join(s.trim());
        }
    }
    if let Err(e) = tokio::fs::create_dir_all(&parent).await {
        return ActionResult {
            ok: false,
            output: format!("Failed to create parent dir: {}", e),
            path: None,
        };
    }
    let target = target_name.map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or(repo);
    let clone_path = parent.join(target);

    let clone_res = Command::new("git")
        .arg("clone")
        .arg(&auth_url)
        .arg(&clone_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match clone_res {
        Ok(o) if o.status.success() => {
            let _ = Command::new("git")
                .arg("-C")
                .arg(&clone_path)
                .args(["remote", "set-url", "origin", &clean_url(owner, repo)])
                .output()
                .await;
            let msg = format!(
                "{}{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            )
            .trim()
            .to_string();
            ActionResult {
                ok: true,
                output: sanitize_token(&msg),
                path: Some(clone_path.to_string_lossy().to_string()),
            }
        }
        Ok(o) => {
            let msg = format!(
                "{}{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            );
            ActionResult {
                ok: false,
                output: sanitize_token(&msg),
                path: None,
            }
        }
        Err(e) => ActionResult {
            ok: false,
            output: sanitize_token(&e.to_string()),
            path: None,
        },
    }
}

pub async fn open_in_ide(repo_path: &Path, ide_override: Option<&str>) -> ActionResult {
    let ide = match ide_override {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => detect_ide(repo_path).await,
    };

    let path_str = repo_path.to_string_lossy().to_string();

    // "finder" is the explicit "just open the folder in the OS file browser" path.
    if ide == "finder" {
        return open_in_file_browser(&path_str).await;
    }

    let primary = Command::new(&ide)
        .arg(&path_str)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match primary {
        Ok(o) if o.status.success() => ActionResult {
            ok: true,
            output: format!("opened in {}", ide),
            path: None,
        },
        _ => {
            // IDE not available — fall back to the OS file browser so at least
            // the user lands in the right folder.
            let mut fb = open_in_file_browser(&path_str).await;
            if fb.ok {
                fb.output = format!("fallback: opened in file browser ({} not found)", ide);
            }
            fb
        }
    }
}

async fn open_in_file_browser(path_str: &str) -> ActionResult {
    let (program, args): (&str, Vec<&str>) = if cfg!(target_os = "macos") {
        ("open", vec![path_str])
    } else if cfg!(target_os = "windows") {
        ("explorer.exe", vec![path_str])
    } else {
        ("xdg-open", vec![path_str])
    };

    let out = Command::new(program)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;
    match out {
        // Windows' explorer.exe exits non-zero (1) even on success — treat spawn as success.
        Ok(_) if cfg!(target_os = "windows") => ActionResult {
            ok: true,
            output: "opened in Explorer".into(),
            path: None,
        },
        Ok(o) if o.status.success() => ActionResult {
            ok: true,
            output: "opened in file browser".into(),
            path: None,
        },
        Ok(o) => ActionResult {
            ok: false,
            output: String::from_utf8_lossy(&o.stderr).to_string(),
            path: None,
        },
        Err(e) => ActionResult {
            ok: false,
            output: e.to_string(),
            path: None,
        },
    }
}

async fn detect_ide(repo_path: &Path) -> String {
    let Ok(mut rd) = tokio::fs::read_dir(repo_path).await else {
        return "open".into();
    };
    let mut names: Vec<String> = Vec::new();
    while let Ok(Some(entry)) = rd.next_entry().await {
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    let has = |n: &str| names.iter().any(|f| f == n);
    let has_suffix = |suf: &str| names.iter().any(|f| f.ends_with(suf));

    if has("pubspec.yaml") {
        return "studio".into();
    }
    if has_suffix(".sln") || has_suffix(".csproj") {
        return "rider".into();
    }
    if has("composer.json") || has("artisan") {
        return "phpstorm".into();
    }
    if has("package.json") && !has("pubspec.yaml") {
        return "webstorm".into();
    }
    if has("pyproject.toml") || has("requirements.txt") || has("setup.py") {
        return "pycharm".into();
    }
    if has("go.mod") {
        return "goland".into();
    }
    "idea".into()
}

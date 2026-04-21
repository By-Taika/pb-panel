use std::path::Path;
use std::process::Stdio;

use serde::Serialize;
use tokio::process::Command;

use crate::git_ops::ActionResult;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit_subject: Option<String>,
    pub last_commit_relative: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    pub index: u32,
    pub message: String,
    pub relative_time: String,
}

async fn run_git_raw(cwd: &Path, args: &[&str]) -> (bool, String) {
    let out = Command::new("git")
        .arg("-C")
        .arg(cwd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;
    match out {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            let combined = format!("{}{}", stdout, stderr).trim().to_string();
            (o.status.success(), combined)
        }
        Err(e) => (false, e.to_string()),
    }
}

async fn run_git_action(cwd: &Path, args: &[&str]) -> ActionResult {
    let (ok, output) = run_git_raw(cwd, args).await;
    ActionResult { ok, output, path: None }
}

pub async fn list_branches(repo_path: &Path) -> Vec<BranchInfo> {
    // One for-each-ref call pulls everything we need (local + remote tracking).
    // Format: refname|HEAD|upstream|ahead-behind|subject|relative
    let format = "%(refname:short)\x1f%(HEAD)\x1f%(upstream:short)\x1f%(upstream:track)\x1f%(contents:subject)\x1f%(committerdate:relative)";
    let (ok, out) = run_git_raw(
        repo_path,
        &[
            "for-each-ref",
            "--sort=-committerdate",
            &format!("--format={}", format),
            "refs/heads",
            "refs/remotes",
        ],
    )
    .await;
    if !ok {
        return Vec::new();
    }

    let mut branches = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.len() < 6 {
            continue;
        }
        let name = parts[0].to_string();
        // Skip detached HEAD duplicates like "origin/HEAD".
        if name.ends_with("/HEAD") {
            continue;
        }
        let is_current = parts[1].trim() == "*";
        let upstream_raw = parts[2].trim();
        let upstream = if upstream_raw.is_empty() {
            None
        } else {
            Some(upstream_raw.to_string())
        };
        let (ahead, behind) = parse_track(parts[3]);
        branches.push(BranchInfo {
            is_remote: name.contains('/') && name.split('/').next().map(|p| p == "origin" || p == "upstream" || p.chars().any(|c| c == '-')).unwrap_or(false),
            name,
            is_current,
            upstream,
            ahead,
            behind,
            last_commit_subject: Some(parts[4].to_string()).filter(|s| !s.is_empty()),
            last_commit_relative: Some(parts[5].to_string()).filter(|s| !s.is_empty()),
        });
    }
    // Local branches should appear first.
    branches.sort_by(|a, b| a.is_remote.cmp(&b.is_remote).then(a.name.cmp(&b.name)));
    branches
}

fn parse_track(s: &str) -> (u32, u32) {
    // `%(upstream:track)` returns things like "[ahead 2, behind 1]" or "[gone]" or "".
    let mut ahead = 0u32;
    let mut behind = 0u32;
    if let Some(stripped) = s.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
        for tok in stripped.split(',').map(|p| p.trim()) {
            if let Some(rest) = tok.strip_prefix("ahead ") {
                ahead = rest.parse().unwrap_or(0);
            } else if let Some(rest) = tok.strip_prefix("behind ") {
                behind = rest.parse().unwrap_or(0);
            }
        }
    }
    (ahead, behind)
}

pub async fn checkout_branch(repo_path: &Path, name: &str) -> ActionResult {
    // Prevent destructive checkout on a dirty tree — surface the error clearly.
    let (dirty_ok, dirty_out) = run_git_raw(repo_path, &["status", "--porcelain"]).await;
    if dirty_ok && !dirty_out.is_empty() {
        return ActionResult {
            ok: false,
            output: "Working tree kirli. Önce commit/stash yap veya reset çek.".to_string(),
            path: None,
        };
    }
    run_git_action(repo_path, &["checkout", name]).await
}

pub async fn create_branch(repo_path: &Path, name: &str, checkout: bool) -> ActionResult {
    let n = name.trim();
    if n.is_empty() {
        return ActionResult { ok: false, output: "Branch adı boş olamaz".into(), path: None };
    }
    if checkout {
        run_git_action(repo_path, &["checkout", "-b", n]).await
    } else {
        run_git_action(repo_path, &["branch", n]).await
    }
}

pub async fn delete_branch(repo_path: &Path, name: &str, force: bool) -> ActionResult {
    let flag = if force { "-D" } else { "-d" };
    run_git_action(repo_path, &["branch", flag, name]).await
}

pub async fn push_branch(repo_path: &Path, name: &str, set_upstream: bool) -> ActionResult {
    if set_upstream {
        run_git_action(repo_path, &["push", "-u", "origin", name]).await
    } else {
        run_git_action(repo_path, &["push", "origin", name]).await
    }
}

pub async fn list_stashes(repo_path: &Path) -> Vec<StashEntry> {
    let (ok, out) = run_git_raw(
        repo_path,
        &["stash", "list", "--format=%gd\x1f%gs\x1f%cr"],
    )
    .await;
    if !ok {
        return Vec::new();
    }
    out.lines()
        .enumerate()
        .filter_map(|(i, line)| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() < 3 {
                return None;
            }
            Some(StashEntry {
                index: i as u32,
                message: parts[1].to_string(),
                relative_time: parts[2].to_string(),
            })
        })
        .collect()
}

pub async fn stash_save(repo_path: &Path, message: Option<&str>) -> ActionResult {
    let mut args: Vec<&str> = vec!["stash", "push"];
    if let Some(m) = message {
        if !m.trim().is_empty() {
            args.push("-m");
            args.push(m);
        }
    }
    run_git_action(repo_path, &args).await
}

pub async fn stash_pop(repo_path: &Path, index: u32) -> ActionResult {
    let idx = format!("stash@{{{}}}", index);
    run_git_action(repo_path, &["stash", "pop", &idx]).await
}

pub async fn stash_drop(repo_path: &Path, index: u32) -> ActionResult {
    let idx = format!("stash@{{{}}}", index);
    run_git_action(repo_path, &["stash", "drop", &idx]).await
}

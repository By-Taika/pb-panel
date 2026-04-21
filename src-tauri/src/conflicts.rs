use std::path::Path;
use std::process::Stdio;

use serde::Serialize;
use tokio::process::Command;

use crate::git_ops::ActionResult;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    pub status_code: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConflictState {
    pub in_merge: bool,
    pub in_rebase: bool,
    pub files: Vec<ConflictFile>,
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
        Ok(o) => (
            o.status.success(),
            String::from_utf8_lossy(&o.stdout).to_string(),
        ),
        Err(_) => (false, String::new()),
    }
}

pub async fn detect(repo_path: &Path) -> ConflictState {
    let git_dir_out = run_git_raw(repo_path, &["rev-parse", "--git-dir"]).await;
    let git_dir = if git_dir_out.0 {
        let trimmed = git_dir_out.1.trim().to_string();
        if trimmed.starts_with('/') {
            std::path::PathBuf::from(trimmed)
        } else {
            repo_path.join(trimmed)
        }
    } else {
        repo_path.join(".git")
    };

    let in_merge = tokio::fs::try_exists(git_dir.join("MERGE_HEAD"))
        .await
        .unwrap_or(false);
    let in_rebase = tokio::fs::try_exists(git_dir.join("rebase-merge"))
        .await
        .unwrap_or(false)
        || tokio::fs::try_exists(git_dir.join("rebase-apply"))
            .await
            .unwrap_or(false);

    let (ok, out) = run_git_raw(repo_path, &["status", "--porcelain=v1"]).await;
    let mut files = Vec::new();
    if ok {
        for line in out.lines() {
            if line.len() < 3 {
                continue;
            }
            let code = &line[..2];
            // Conflict status codes per git-status(1): DD, AU, UD, UA, DU, AA, UU.
            let is_conflict = matches!(
                code,
                "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU"
            );
            if is_conflict {
                let path = line[3..].trim().to_string();
                files.push(ConflictFile {
                    path,
                    status_code: code.to_string(),
                });
            }
        }
    }
    ConflictState { in_merge, in_rebase, files }
}

pub async fn get_diff(repo_path: &Path, file: &str) -> String {
    // diff3-style shows ours + base + theirs for conflict regions.
    let out = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["diff", "--diff-algorithm=histogram", file])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;
    match out {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(e) => format!("diff failed: {}", e),
    }
}

pub async fn resolve_ours(repo_path: &Path, file: &str) -> ActionResult {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["checkout", "--ours", file])
        .output()
        .await;
    match out {
        Ok(o) if o.status.success() => {
            let _ = Command::new("git")
                .arg("-C")
                .arg(repo_path)
                .args(["add", file])
                .output()
                .await;
            ActionResult { ok: true, output: format!("{} → ours seçildi", file), path: None }
        }
        Ok(o) => ActionResult {
            ok: false,
            output: String::from_utf8_lossy(&o.stderr).to_string(),
            path: None,
        },
        Err(e) => ActionResult { ok: false, output: e.to_string(), path: None },
    }
}

pub async fn resolve_theirs(repo_path: &Path, file: &str) -> ActionResult {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["checkout", "--theirs", file])
        .output()
        .await;
    match out {
        Ok(o) if o.status.success() => {
            let _ = Command::new("git")
                .arg("-C")
                .arg(repo_path)
                .args(["add", file])
                .output()
                .await;
            ActionResult { ok: true, output: format!("{} → theirs seçildi", file), path: None }
        }
        Ok(o) => ActionResult {
            ok: false,
            output: String::from_utf8_lossy(&o.stderr).to_string(),
            path: None,
        },
        Err(e) => ActionResult { ok: false, output: e.to_string(), path: None },
    }
}

pub async fn abort_merge(repo_path: &Path) -> ActionResult {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["merge", "--abort"])
        .output()
        .await;
    match out {
        Ok(o) if o.status.success() => ActionResult { ok: true, output: "merge iptal edildi".into(), path: None },
        Ok(o) => ActionResult {
            ok: false,
            output: String::from_utf8_lossy(&o.stderr).to_string(),
            path: None,
        },
        Err(e) => ActionResult { ok: false, output: e.to_string(), path: None },
    }
}

pub async fn continue_merge(repo_path: &Path) -> ActionResult {
    // Finalize after all conflicts are resolved + staged.
    let out = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(["commit", "--no-edit"])
        .output()
        .await;
    match out {
        Ok(o) if o.status.success() => ActionResult { ok: true, output: "merge tamamlandı".into(), path: None },
        Ok(o) => ActionResult {
            ok: false,
            output: String::from_utf8_lossy(&o.stderr).to_string(),
            path: None,
        },
        Err(e) => ActionResult { ok: false, output: e.to_string(), path: None },
    }
}

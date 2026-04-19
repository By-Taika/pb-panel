use std::fs;
use std::path::PathBuf;

/// Loads environment variables from `~/.config/gh-tokens/*.env` into the process env.
///
/// Matches lines of the shell form:
///   export GH_TOKEN_RANI="ghp_xxx"
///   export GH_TOKEN_PERSONAL=ghp_xxx
///
/// Safe to call multiple times — never overwrites an already-set var.
pub fn load_token_files() {
    let Some(home) = dirs::home_dir() else { return };
    let dir: PathBuf = home.join(".config").join("gh-tokens");
    let Ok(entries) = fs::read_dir(&dir) else { return };

    let re = regex::Regex::new(
        r#"^\s*export\s+([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?"#,
    )
    .unwrap();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("env") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else { continue };
        for line in raw.lines() {
            let Some(cap) = re.captures(line) else { continue };
            let key = &cap[1];
            let val = cap[2].trim().trim_matches('"');
            if std::env::var_os(key).is_none() {
                // SAFETY: Tauri runs single-threaded during initialization, before any async runtime
                // or window creation. We also treat missing keys as the only write case, so no concurrent
                // readers are observing the same key.
                unsafe { std::env::set_var(key, val) };
            }
        }
    }
}

pub fn token_for(account: &str) -> Option<String> {
    let key = match account {
        "rani" => "GH_TOKEN_RANI",
        "personal" => "GH_TOKEN_PERSONAL",
        _ => return None,
    };
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

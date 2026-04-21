use std::fs;
use std::path::PathBuf;

const KEYCHAIN_SERVICE: &str = "com.codecrew.pbpanel";

/// Back-compat shim: if the user has GitHub tokens sitting in
/// `~/.config/gh-tokens/*.env` (the pre-keychain layout), pull them into the
/// process environment so account configs that still reference those env vars
/// keep working until they're migrated to the keychain.
pub fn load_env_token_files() {
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
                // SAFETY: called once during app startup, before any threads
                // have spawned, so no concurrent readers observe this write.
                unsafe { std::env::set_var(key, val) };
            }
        }
    }
}

/// Resolves a GitHub token for `account_id`.
/// Order:
///   1. macOS Keychain (preferred — set via Settings panel)
///   2. Env var (if the account config names one — back-compat for users who
///      still source `~/.config/gh-tokens/*.env`).
pub fn token_for(account_id: &str, env_var: Option<&str>) -> Option<String> {
    if let Some(t) = keychain_get(account_id) {
        if !t.is_empty() {
            return Some(t);
        }
    }
    if let Some(key) = env_var {
        if let Ok(v) = std::env::var(key) {
            if !v.is_empty() {
                return Some(v);
            }
        }
    }
    None
}

pub fn keychain_set(account_id: &str, token: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account_id)
        .map_err(|e| format!("keychain open: {}", e))?;
    entry
        .set_password(token)
        .map_err(|e| format!("keychain write: {}", e))
}

pub fn keychain_get(account_id: &str) -> Option<String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account_id)
        .ok()?
        .get_password()
        .ok()
}

pub fn keychain_delete(account_id: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account_id)
        .map_err(|e| format!("keychain open: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keychain delete: {}", e)),
    }
}

pub fn keychain_has(account_id: &str) -> bool {
    keychain_get(account_id).is_some()
}

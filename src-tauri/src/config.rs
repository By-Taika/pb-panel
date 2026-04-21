use std::path::PathBuf;
use std::sync::RwLock;

use serde::{Deserialize, Serialize};

pub const CONFIG_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountConfig {
    /// Stable id used in category mapping and keychain lookup.
    pub id: String,
    /// Friendly label shown in the UI (e.g. "Work", "Personal").
    pub label: String,
    /// GitHub username for the account — used when building auth URLs for cloning.
    #[serde(default)]
    pub username: Option<String>,
    /// Env var name that historically held the token (optional — only used as a
    /// fallback when the keychain entry is missing, so env-var based setups
    /// keep working during the transition to keychain-backed tokens).
    #[serde(default)]
    pub env_var: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CategoryConfig {
    /// Folder name under `baseDir` (e.g. "work", "personal").
    pub name: String,
    /// Account id this category maps to.
    pub account_id: String,
    /// If true, pb-panel walks one level deeper (Category/Sub/repo layout).
    /// If false, only direct children of `Category/` are scanned.
    #[serde(default = "default_true")]
    pub nested: bool,
    /// Repo names to hide from the panel (case-sensitive).
    #[serde(default)]
    pub hide: Vec<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub version: u32,
    /// Root directory that holds all category folders.
    pub base_dir: String,
    pub accounts: Vec<AccountConfig>,
    pub categories: Vec<CategoryConfig>,
    /// Once true, never shows the onboarding wizard again. Reset by
    /// `save_config({ firstRunComplete: false })` from the UI.
    #[serde(default)]
    pub first_run_complete: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            base_dir: default_base_dir(),
            accounts: Vec::new(),
            categories: Vec::new(),
            first_run_complete: false,
        }
    }
}

fn default_base_dir() -> String {
    dirs::home_dir()
        .map(|h| h.join("ProjectBase").to_string_lossy().to_string())
        .unwrap_or_else(|| "~/ProjectBase".into())
}

fn config_dir() -> PathBuf {
    // macOS: ~/Library/Application Support/com.codecrew.pbpanel/
    // Linux: ~/.config/com.codecrew.pbpanel/
    // Windows: %APPDATA%/com.codecrew.pbpanel/
    let base = dirs::config_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("com.codecrew.pbpanel")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load() -> Config {
    let path = config_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(c) = serde_json::from_str::<Config>(&raw) {
            return c;
        }
    }
    // No valid config on disk — hand back a bare default; the onboarding
    // wizard walks the user through filling it in.
    Config::default()
}

pub fn save(cfg: &Config) -> Result<(), String> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    let path = config_path();
    let raw = serde_json::to_string_pretty(cfg)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    // Atomic write: write to .tmp then rename, so a crash mid-write never
    // leaves a half-written JSON file that would fail to parse on next load.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, raw).map_err(|e| format!("Failed to write config tmp: {}", e))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("Failed to finalize config: {}", e))?;
    Ok(())
}

// ---- Shared in-memory config ---------------------------------------------

pub struct ConfigStore {
    inner: RwLock<Config>,
}

impl ConfigStore {
    pub fn new(cfg: Config) -> Self {
        Self {
            inner: RwLock::new(cfg),
        }
    }

    pub fn snapshot(&self) -> Config {
        self.inner.read().unwrap().clone()
    }

    pub fn replace(&self, cfg: Config) -> Result<(), String> {
        save(&cfg)?;
        *self.inner.write().unwrap() = cfg;
        Ok(())
    }
}

pub fn config_path_display() -> String {
    config_path().to_string_lossy().to_string()
}

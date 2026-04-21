mod branches;
mod config;
mod conflicts;
mod github;
mod git_ops;
mod prs;
mod repo;
mod tokens;

use std::collections::BTreeMap;
use std::time::Duration;

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};

use crate::config::{Config, ConfigStore};
use crate::repo::{get_repo_info, is_valid_category, list_all_repos, repo_path_for, RepoInfo};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Health {
    ok: bool,
    config_path: String,
    version: u32,
}

#[tauri::command]
fn health() -> Health {
    Health {
        ok: true,
        config_path: config::config_path_display(),
        version: config::CONFIG_VERSION,
    }
}

#[tauri::command]
fn get_config(store: State<'_, ConfigStore>) -> Config {
    store.snapshot()
}

#[tauri::command]
fn save_config(store: State<'_, ConfigStore>, cfg: Config) -> Result<(), String> {
    store.replace(cfg)
}

#[tauri::command]
fn account_has_token(account_id: String) -> bool {
    tokens::keychain_has(&account_id)
}

#[tauri::command]
fn set_account_token(account_id: String, token: String) -> Result<(), String> {
    if account_id.trim().is_empty() {
        return Err("account id required".into());
    }
    if token.trim().is_empty() {
        return Err("token required".into());
    }
    tokens::keychain_set(&account_id, &token)
}

#[tauri::command]
fn delete_account_token(account_id: String) -> Result<(), String> {
    tokens::keychain_delete(&account_id)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountCard {
    login: String,
    name: String,
    avatar: String,
}

#[tauri::command]
async fn accounts(
    store: State<'_, ConfigStore>,
) -> Result<BTreeMap<String, Option<AccountCard>>, String> {
    let cfg = store.snapshot();
    let futures = cfg.accounts.iter().map(|acc| {
        let id = acc.id.clone();
        let env = acc.env_var.clone();
        let label_fallback = acc.label.clone();
        async move {
            let token = tokens::token_for(&id, env.as_deref());
            let card = match token {
                Some(_) => github::fetch_user(&id, env.as_deref())
                    .await
                    .map(|u| AccountCard {
                        login: u.login.clone(),
                        name: u.name.unwrap_or(u.login),
                        avatar: u.avatar_url,
                    })
                    .or(Some(AccountCard {
                        login: id.clone(),
                        name: label_fallback.clone(),
                        avatar: String::new(),
                    })),
                None => None,
            };
            (id, card)
        }
    });
    let results = futures::future::join_all(futures).await;
    let mut map: BTreeMap<String, Option<AccountCard>> = BTreeMap::new();
    for (id, card) in results {
        map.insert(id, card);
    }
    Ok(map)
}

#[tauri::command]
async fn repos(
    store: State<'_, ConfigStore>,
) -> Result<BTreeMap<String, Vec<RepoInfo>>, String> {
    let cfg = store.snapshot();
    Ok(list_all_repos(&cfg).await)
}

fn guard_category(cfg: &Config, c: &str) -> Result<(), String> {
    if !is_valid_category(cfg, c) {
        return Err(format!("invalid category: {}", c));
    }
    Ok(())
}

#[tauri::command]
async fn repo_info(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<RepoInfo, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    if info.branch.is_none() && info.last_commit.is_none() {
        return Err("not a git repo".into());
    }
    Ok(info)
}

#[tauri::command]
async fn repo_prs(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<Vec<github::OpenPr>, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (Some(owner), Some(repo_name)) = (info.owner.as_deref(), info.repo_name.as_deref()) else {
        return Ok(Vec::new());
    };
    let env = cfg
        .accounts
        .iter()
        .find(|a| a.id == info.account)
        .and_then(|a| a.env_var.clone());
    Ok(github::fetch_open_prs(owner, repo_name, &info.account, env.as_deref()).await)
}

#[tauri::command]
async fn repo_meta(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<Option<github::RepoMeta>, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (Some(owner), Some(repo_name)) = (info.owner.as_deref(), info.repo_name.as_deref()) else {
        return Ok(None);
    };
    let env = cfg
        .accounts
        .iter()
        .find(|a| a.id == info.account)
        .and_then(|a| a.env_var.clone());
    Ok(github::fetch_repo_meta(owner, repo_name, &info.account, env.as_deref()).await)
}

#[tauri::command]
async fn repo_log(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<serde_json::Value>, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(git_ops::log_commits(&path, limit.unwrap_or(30)).await)
}

#[tauri::command]
async fn repo_pull(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(git_ops::pull(&path).await)
}

#[tauri::command]
async fn repo_fetch(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(git_ops::fetch(&path).await)
}

#[tauri::command]
async fn repo_open(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    ide: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(git_ops::open_in_ide(&path, ide.as_deref()).await)
}

#[tauri::command]
async fn repo_clone(
    store: State<'_, ConfigStore>,
    category: String,
    sub_category: Option<String>,
    owner_repo: String,
    target_name: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    if !is_valid_category(&cfg, &category) {
        return Err(format!("invalid category: {}", category));
    }
    Ok(git_ops::clone_repo(
        &cfg,
        &category,
        sub_category.as_deref(),
        &owner_repo,
        target_name.as_deref(),
    )
    .await)
}

// ---------- Branch management ----------

#[tauri::command]
async fn repo_branches(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<Vec<branches::BranchInfo>, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::list_branches(&path).await)
}

#[tauri::command]
async fn branch_checkout(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    branch: String,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::checkout_branch(&path, &branch).await)
}

#[tauri::command]
async fn branch_create(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    branch: String,
    checkout: Option<bool>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::create_branch(&path, &branch, checkout.unwrap_or(true)).await)
}

#[tauri::command]
async fn branch_delete(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    branch: String,
    force: Option<bool>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::delete_branch(&path, &branch, force.unwrap_or(false)).await)
}

#[tauri::command]
async fn branch_push(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    branch: String,
    set_upstream: Option<bool>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::push_branch(&path, &branch, set_upstream.unwrap_or(false)).await)
}

#[tauri::command]
async fn repo_stashes(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<Vec<branches::StashEntry>, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::list_stashes(&path).await)
}

#[tauri::command]
async fn stash_save(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    message: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::stash_save(&path, message.as_deref()).await)
}

#[tauri::command]
async fn stash_pop(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    index: u32,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::stash_pop(&path, index).await)
}

#[tauri::command]
async fn stash_drop(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    index: u32,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(branches::stash_drop(&path, index).await)
}

// ---------- Conflict handling ----------

#[tauri::command]
async fn repo_conflicts(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<conflicts::ConflictState, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(conflicts::detect(&path).await)
}

#[tauri::command]
async fn conflict_diff(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    file: String,
) -> Result<String, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(conflicts::get_diff(&path, &file).await)
}

#[tauri::command]
async fn conflict_resolve_ours(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    file: String,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(conflicts::resolve_ours(&path, &file).await)
}

#[tauri::command]
async fn conflict_resolve_theirs(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    file: String,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(conflicts::resolve_theirs(&path, &file).await)
}

#[tauri::command]
async fn conflict_abort(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(conflicts::abort_merge(&path).await)
}

#[tauri::command]
async fn conflict_continue(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    Ok(conflicts::continue_merge(&path).await)
}

// ---------- PR management (GitHub API) ----------

fn env_for_account(cfg: &Config, account_id: &str) -> Option<String> {
    cfg.accounts
        .iter()
        .find(|a| a.id == account_id)
        .and_then(|a| a.env_var.clone())
}

#[tauri::command]
async fn pr_detail(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    number: u32,
) -> Result<prs::PrDetail, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (owner, repo_name) = match (info.owner.as_deref(), info.repo_name.as_deref()) {
        (Some(o), Some(r)) => (o, r),
        _ => return Err("owner/repo çözülemedi".into()),
    };
    let env = env_for_account(&cfg, &info.account);
    prs::get_pr_detail(owner, repo_name, number, &info.account, env.as_deref()).await
}

#[tauri::command]
async fn pr_create(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    head: String,
    base: String,
    title: String,
    body: Option<String>,
    draft: Option<bool>,
) -> Result<prs::PrDetail, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (owner, repo_name) = match (info.owner.as_deref(), info.repo_name.as_deref()) {
        (Some(o), Some(r)) => (o, r),
        _ => return Err("owner/repo çözülemedi".into()),
    };
    let env = env_for_account(&cfg, &info.account);
    prs::create_pr(
        owner,
        repo_name,
        &head,
        &base,
        &title,
        body.as_deref(),
        draft.unwrap_or(false),
        &info.account,
        env.as_deref(),
    )
    .await
}

#[tauri::command]
async fn pr_merge(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    number: u32,
    method: Option<String>,
) -> Result<String, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (owner, repo_name) = match (info.owner.as_deref(), info.repo_name.as_deref()) {
        (Some(o), Some(r)) => (o, r),
        _ => return Err("owner/repo çözülemedi".into()),
    };
    let env = env_for_account(&cfg, &info.account);
    prs::merge_pr(
        owner,
        repo_name,
        number,
        method.as_deref().unwrap_or("squash"),
        &info.account,
        env.as_deref(),
    )
    .await
}

#[tauri::command]
async fn pr_enable_auto_merge(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    number: u32,
    method: Option<String>,
) -> Result<String, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (owner, repo_name) = match (info.owner.as_deref(), info.repo_name.as_deref()) {
        (Some(o), Some(r)) => (o, r),
        _ => return Err("owner/repo çözülemedi".into()),
    };
    let env = env_for_account(&cfg, &info.account);
    prs::enable_auto_merge(
        owner,
        repo_name,
        number,
        method.as_deref().unwrap_or("squash"),
        &info.account,
        env.as_deref(),
    )
    .await
}

#[tauri::command]
async fn pr_disable_auto_merge(
    store: State<'_, ConfigStore>,
    category: String,
    name: String,
    sub: Option<String>,
    number: u32,
) -> Result<String, String> {
    let cfg = store.snapshot();
    guard_category(&cfg, &category)?;
    let path = repo_path_for(&cfg, &category, sub.as_deref(), &name);
    let info = get_repo_info(&cfg, &category, sub.as_deref(), &name, &path).await;
    let (owner, repo_name) = match (info.owner.as_deref(), info.repo_name.as_deref()) {
        (Some(o), Some(r)) => (o, r),
        _ => return Err("owner/repo çözülemedi".into()),
    };
    let env = env_for_account(&cfg, &info.account);
    prs::disable_auto_merge(owner, repo_name, number, &info.account, env.as_deref()).await
}

/// Scan a directory and return its direct subfolder names (for auto-populating
/// categories during onboarding).
#[tauri::command]
async fn list_subfolders(path: String) -> Vec<String> {
    let Ok(mut rd) = tokio::fs::read_dir(&path).await else {
        return Vec::new();
    };
    let mut names = Vec::new();
    while let Ok(Some(entry)) = rd.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if let Ok(meta) = entry.metadata().await {
            if meta.is_dir() {
                names.push(name);
            }
        }
    }
    names.sort();
    names
}

fn summarize(map: &BTreeMap<String, Vec<RepoInfo>>) -> (usize, usize, usize) {
    let mut total = 0usize;
    let mut dirty_files = 0usize;
    let mut behind = 0usize;
    for list in map.values() {
        total += list.len();
        for r in list {
            dirty_files += r.dirty;
            if r.behind > 0 {
                behind += 1;
            }
        }
    }
    (total, dirty_files, behind)
}

fn tray_tooltip(total: usize, dirty: usize, behind: usize) -> String {
    let mut parts = vec![format!("{} repo", total)];
    if dirty > 0 {
        parts.push(format!("{} dirty", dirty));
    }
    if behind > 0 {
        parts.push(format!("{} behind", behind));
    }
    parts.join(" · ")
}

fn show_main_window(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.show();
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_fullscreen().unwrap_or(false) {
            let _ = win.set_fullscreen(false);
        }
    }
    #[cfg(target_os = "macos")]
    let _ = app.hide();
    #[cfg(not(target_os = "macos"))]
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

fn toggle_main_window(app: &tauri::AppHandle) {
    let visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    let focused = app
        .get_webview_window("main")
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false);
    if visible && focused {
        hide_main_window(app);
    } else {
        show_main_window(app);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Legacy env-based token files (~/.config/gh-tokens/*.env) get loaded so
    // existing installs keep working until they migrate tokens to the keychain.
    tokens::load_env_token_files();

    let config_snapshot = config::load();
    let store = ConfigStore::new(config_snapshot);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(store)
        .on_window_event(|win, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if win.label() == "main" {
                    api.prevent_close();
                    hide_main_window(&win.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            health,
            get_config,
            save_config,
            account_has_token,
            set_account_token,
            delete_account_token,
            accounts,
            repos,
            repo_info,
            repo_prs,
            repo_meta,
            repo_log,
            repo_pull,
            repo_fetch,
            repo_open,
            repo_clone,
            list_subfolders,
            repo_branches,
            branch_checkout,
            branch_create,
            branch_delete,
            branch_push,
            repo_stashes,
            stash_save,
            stash_pop,
            stash_drop,
            repo_conflicts,
            conflict_diff,
            conflict_resolve_ours,
            conflict_resolve_theirs,
            conflict_abort,
            conflict_continue,
            pr_detail,
            pr_create,
            pr_merge,
            pr_enable_auto_merge,
            pr_disable_auto_merge,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            let show_item = MenuItem::with_id(app, "show", "Paneli göster", true, None::<&str>)?;
            let refresh_item =
                MenuItem::with_id(app, "refresh", "Yeniden tara", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Ayarlar…", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show_item, &refresh_item, &settings_item, &sep, &quit_item],
            )?;

            let default_icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("missing default window icon"))?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(default_icon)
                .icon_as_template(false)
                .tooltip("pb-panel")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "refresh" => {
                        let _ = app.emit("pb-panel://refresh", ());
                    }
                    "settings" => {
                        show_main_window(app);
                        let _ = app.emit("pb-panel://open-settings", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let loop_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let cfg = loop_handle
                        .state::<ConfigStore>()
                        .snapshot();
                    if cfg.categories.is_empty() {
                        // No categories configured yet — sleep and retry.
                        tokio::time::sleep(Duration::from_secs(10)).await;
                        continue;
                    }
                    let snapshot = list_all_repos(&cfg).await;
                    let (total, dirty, behind) = summarize(&snapshot);
                    if let Some(tray) = loop_handle.tray_by_id("main-tray") {
                        let _ = tray.set_tooltip(Some(&tray_tooltip(total, dirty, behind)));
                    }
                    let _ = loop_handle.emit(
                        "pb-panel://tray-stats",
                        serde_json::json!({
                            "total": total,
                            "dirty": dirty,
                            "behind": behind,
                        }),
                    );
                    tokio::time::sleep(Duration::from_secs(60)).await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

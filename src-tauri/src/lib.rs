mod github;
mod git_ops;
mod repo;
mod tokens;

use std::collections::BTreeMap;
use std::time::Duration;

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

use crate::repo::{
    get_repo_info, is_valid_category, list_all_repos, repo_path_for, RepoInfo, CATEGORIES,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Health {
    ok: bool,
    base: String,
    categories: Vec<&'static str>,
}

#[tauri::command]
fn health() -> Health {
    Health {
        ok: true,
        base: repo::base_dir().to_string_lossy().to_string(),
        categories: CATEGORIES.to_vec(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountCard {
    login: String,
    name: String,
    avatar: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountsInfo {
    rani: Option<AccountCard>,
    personal: Option<AccountCard>,
}

#[tauri::command]
async fn accounts() -> AccountsInfo {
    let (rani, personal) = tokio::join!(
        github::fetch_user("rani"),
        github::fetch_user("personal"),
    );
    fn map(u: Option<github::GhUserInfo>) -> Option<AccountCard> {
        u.map(|u| AccountCard {
            login: u.login.clone(),
            name: u.name.unwrap_or(u.login),
            avatar: u.avatar_url,
        })
    }
    AccountsInfo {
        rani: map(rani),
        personal: map(personal),
    }
}

#[tauri::command]
async fn repos() -> BTreeMap<String, Vec<RepoInfo>> {
    list_all_repos().await
}

fn guard_category(c: &str) -> Result<(), String> {
    if !is_valid_category(c) {
        return Err(format!("invalid category: {}", c));
    }
    Ok(())
}

#[tauri::command]
async fn repo_info(
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<RepoInfo, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    let info = get_repo_info(&category, sub.as_deref(), &name, &path).await;
    if info.branch.is_none() && info.last_commit.is_none() {
        return Err("not a git repo".into());
    }
    Ok(info)
}

#[tauri::command]
async fn repo_prs(
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<Vec<github::OpenPr>, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    let info = get_repo_info(&category, sub.as_deref(), &name, &path).await;
    let (Some(owner), Some(repo_name)) = (info.owner.as_deref(), info.repo_name.as_deref()) else {
        return Ok(Vec::new());
    };
    Ok(github::fetch_open_prs(owner, repo_name, &info.account).await)
}

#[tauri::command]
async fn repo_meta(
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<Option<github::RepoMeta>, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    let info = get_repo_info(&category, sub.as_deref(), &name, &path).await;
    let (Some(owner), Some(repo_name)) = (info.owner.as_deref(), info.repo_name.as_deref()) else {
        return Ok(None);
    };
    Ok(github::fetch_repo_meta(owner, repo_name, &info.account).await)
}

#[tauri::command]
async fn repo_log(
    category: String,
    name: String,
    sub: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<serde_json::Value>, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    Ok(git_ops::log_commits(&path, limit.unwrap_or(30)).await)
}

#[tauri::command]
async fn repo_pull(
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    Ok(git_ops::pull(&path).await)
}

#[tauri::command]
async fn repo_fetch(
    category: String,
    name: String,
    sub: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    Ok(git_ops::fetch(&path).await)
}

#[tauri::command]
async fn repo_open(
    category: String,
    name: String,
    sub: Option<String>,
    ide: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    guard_category(&category)?;
    let path = repo_path_for(&category, sub.as_deref(), &name);
    Ok(git_ops::open_in_ide(&path, ide.as_deref()).await)
}

#[tauri::command]
async fn repo_clone(
    category: String,
    sub_category: Option<String>,
    owner_repo: String,
    target_name: Option<String>,
) -> Result<git_ops::ActionResult, String> {
    if !is_valid_category(&category) {
        return Err(format!("invalid category: {}", category));
    }
    Ok(git_ops::clone_repo(
        &category,
        sub_category.as_deref(),
        &owner_repo,
        target_name.as_deref(),
    )
    .await)
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

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        match win.is_visible() {
            Ok(true) => {
                let _ = win.hide();
            }
            _ => {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.unminimize();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load ~/.config/gh-tokens/*.env before anything that may need GitHub tokens.
    tokens::load_token_files();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            health,
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
        ])
        .on_window_event(|win, event| {
            // Hide to tray instead of quitting when the user clicks the red close button.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if win.label() == "main" {
                    api.prevent_close();
                    let _ = win.hide();
                }
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Tray menu
            let show_item = MenuItem::with_id(app, "show", "Paneli göster", true, None::<&str>)?;
            let refresh_item =
                MenuItem::with_id(app, "refresh", "Yeniden tara", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show_item, &refresh_item, &sep, &quit_item],
            )?;

            let default_icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("missing default window icon"))?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(default_icon)
                .icon_as_template(true)
                .tooltip("pb-panel")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_main_window(app),
                    "refresh" => {
                        let _ = app.emit("pb-panel://refresh", ());
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

            // Background scan loop: every 60s refresh tray tooltip + emit event
            // the frontend can listen to. Keeps the dashboard fresh even when
            // the window isn't focused.
            let loop_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let snapshot = list_all_repos().await;
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

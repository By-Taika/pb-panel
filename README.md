# pb-panel

**A lightweight desktop dashboard for managing local git repos across multiple GitHub identities.**

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![built_with](https://img.shields.io/badge/built_with-Tauri_v2-orange)

---

## What it does

If you keep dozens of git repos under a single folder (`~/Projects`, `~/Dev`, `~/ProjectBase`), pb-panel gives you a single place to see which ones are dirty, which are behind origin, which branch you're on, and when the last commit landed — instead of opening a terminal in each one.

It's a native macOS/Windows app (Tauri v2 — no Electron, no background server):

- **Scan** — every git repo under your chosen base folder, up to one level of sub-folders
- **Status at a glance** — branch · dirty files · ahead/behind origin · last commit (author + relative time)
- **Remote update hints** — checks `git ls-remote` across all branches without downloading objects, and flags repos where the remote has commits newer than your last fetch
- **Bulk pull** — pull any repo that's behind with one click
- **Menubar tray** — see dirty/behind counts at a glance even when the window is closed
- **GitHub integration** — open PRs, repo metadata (stars, issues, default branch, `pushed_at`)
- **Commit history** — last 30 commits per repo, in a side drawer
- **Clone** — type `owner/repo`, pb-panel picks the right account's token and clones into the right category
- **Keychain-backed tokens** — stored via macOS Keychain / Windows Credential Manager / libsecret, never in plain files
- **Multi-account** — add as many GitHub identities as you need; each category is pinned to one account

---

## Install

### macOS (Apple Silicon)

1. Grab `pb-panel_x.y.z_aarch64.dmg` from [Releases](https://github.com/By-Taika/pb-panel/releases)
2. Open the DMG and drag `pb-panel.app` into `Applications`
3. On first launch Gatekeeper may warn "unidentified developer":
   - **System Settings → Privacy & Security → Open Anyway**
   - Or from the terminal: `xattr -d com.apple.quarantine /Applications/pb-panel.app`

*(Ad-hoc signed, not notarised — this is normal for open-source Tauri apps. One-time approval on your machine, then it runs like any other app.)*

### Windows 10/11

1. Grab `pb-panel_x.y.z_x64_en-US.msi` from [Releases](https://github.com/By-Taika/pb-panel/releases)
2. Double-click the MSI to install
3. If SmartScreen warns, **More info → Run anyway**
4. Launch "pb-panel" from the Start menu

---

## First-run wizard

A 3-step wizard runs the first time you launch pb-panel:

### 1. General

**Base folder** — the root that contains all your repo folders. Examples:
- `/Users/<you>/Projects`
- `/Users/<you>/Dev`
- `C:\Users\<you>\source`

Sub-folders become categories, and the git repos underneath them get scanned.

### 2. Accounts

Add one entry per GitHub identity:
- **Label** — the name shown in the UI (e.g. "Work", "Personal")
- **Username** — your GitHub handle (used when building clone URLs)
- **Token** — a [Personal Access Token](https://github.com/settings/tokens) with the `repo` scope. Stored in the OS keychain, never written to disk.

### 3. Categories

Pick which sub-folders of your base directory should be listed and which account they belong to. The **"Autofill from base folder"** button scans the directory and adds everything it finds.

When you're done, your config is written to the OS-standard app config directory (the exact path is shown in Settings).

To change anything later, click the **⚙ Settings** button in the top-right or open the tray menu.

---

## UI overview

```
┌─ Header ────────────────────────────────────────────────┐
│ pb-panel · <base folder>   [account A] [account B]  ↻   │
├─ Sidebar ──┬─ Main ─────────────────────────────────────┤
│ All     42 │ Category A (8)                             │
│ ─────      │                                            │
│ Cat. A   8 │ ▸ Sub-folder (3)                           │
│ Cat. B   4 │ ┌────────┐┌────────┐┌────────┐             │
│ Cat. C  22 │ │ repo-a ││ repo-b ││ repo-c │             │
│ Cat. D   8 │ │ main ⎇ ││ main ⎇ ││ dev  ⎇ │             │
│            │ │ clean  ││ 3 dirty││ ↯ 2    │             │
│            │ │ Pull   ││ Pull   ││ Pull   │             │
│            │ └────────┘└────────┘└────────┘             │
└────────────┴────────────────────────────────────────────┘
```

Click the **ⓘ** on any card to open a drawer with:
- GitHub metadata (stars · open issues · default branch · language · pushed_at)
- Open pull requests (click to open in the browser)
- The last 30 commits

The `↯ N` chip on a card means the remote has commits on `N` branches that haven't been fetched yet. Hover to see the branch names.

---

## Menubar tray

- **Left click** — toggle the main window
- **Right click** menu:
  - **Show panel**
  - **Re-scan** (manual trigger in addition to the 30-second auto-scan)
  - **Settings…**
  - **Quit**
- Tooltip: `42 repos · 3 dirty · 2 behind`

---

## Build from source

### Prerequisites
- Rust 1.75+ ([rustup](https://rustup.rs))
- Node 20+ ([nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools + WebView2 (bundled on Windows 11)

### Dev mode
```bash
git clone https://github.com/By-Taika/pb-panel.git
cd pb-panel
npm install
npm run tauri:dev
```

### Release build
```bash
npm run tauri:build
```

Artifacts:
- macOS app: `src-tauri/target/release/bundle/macos/pb-panel.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/pb-panel_*.dmg`
- Windows MSI: `src-tauri/target/release/bundle/msi/pb-panel_*.msi`

### Regenerating icons
```bash
# edit icon-source.svg, then:
qlmanage -t -s 1024 -o . icon-source.svg           # SVG → PNG on macOS
npx @tauri-apps/cli icon icon-source.svg.png       # emit every target size
```

---

## Architecture (short version)

| Layer | Tech |
|---|---|
| UI | React 18 + Vite 5 + TailwindCSS 3 |
| Window + IPC | Tauri v2 (Rust host) |
| Git operations | `tokio::process::Command("git", …)` |
| GitHub API | `reqwest` + per-account token |
| Token storage | `keyring` crate (Keychain / Credential Manager / libsecret) |
| Config | JSON file, atomic write via `.tmp + rename` |

The Rust side shells out to `git` rather than linking libgit2, so anything your local `git` can do, pb-panel can do — no extra dependencies, no version skew.

---

## Privacy

- Tokens are **always** stored in the OS keychain (Keychain, Credential Manager, or libsecret — depending on platform)
- No telemetry, no backend, no network calls except direct GitHub API requests made with your own token
- Clone URLs are masked in logs before being written (`ghp_***`), so tokens never leak into log files

---

## License

MIT — see [LICENSE](LICENSE).

Built with Tauri · Issues and pull requests welcome.

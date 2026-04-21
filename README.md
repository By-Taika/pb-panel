# pb-panel

**Desktop cockpit for managing local git repos across multiple GitHub identities.**

[🇹🇷 Türkçe README](README.tr.md) · English

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![built_with](https://img.shields.io/badge/built_with-Tauri_v2-orange)
[![latest release](https://img.shields.io/github/v/release/By-Taika/pb-panel?label=latest&color=blueviolet)](https://github.com/By-Taika/pb-panel/releases/latest)

## ⬇ Download

| Platform | Installer |
|---|---|
| 🍎 **macOS (Apple Silicon)** | [**Download `.dmg`**](https://github.com/By-Taika/pb-panel/releases/latest) |
| 🪟 **Windows 10 / 11** | [**Download `.msi`**](https://github.com/By-Taika/pb-panel/releases/latest) or [`.exe` (NSIS)](https://github.com/By-Taika/pb-panel/releases/latest) |

Links always point to the most recent release — pick the asset that matches your platform. Once installed, pb-panel will handle updates itself via the built-in updater.

> Intel Mac is not packaged yet. If you need it, open an issue.

---

## What it does

If you keep dozens of git repos under a single root folder (`~/Projects`, `~/Dev`, `~/ProjectBase`), pb-panel lets you see which ones are dirty, which are behind origin, which branch you're on, and when the last commit landed — without opening a terminal in every one of them.

Native macOS/Windows app (Tauri v2 — no Electron, no background server). As of **v0.8** it is not just an observation dashboard, it is a **full git cockpit**:

### Core features

- **Scan** every git repo under your chosen root folder, down to one level of sub-folders
- **At-a-glance status** — branch · dirty file count · ahead/behind · last commit (author + relative time)
- **Remote update hints** — uses `git ls-remote` to detect new upstream commits without fetching
- **Bulk pull** — pull every behind repo with one click
- **Menubar tray** — shows dirty/behind counts while the window is closed
- **Clone** — type `owner/repo`, pb-panel picks the right account's token and drops it into the right category
- **Keychain-backed tokens** — never stored in plain text on disk
- **Multi-account** — work + personal side by side

### New in v0.8 — cockpit features

- **Auto-updater** — panel notifies you when a new release is out, downloads it, verifies the signature, installs and relaunches
- **Branch management** — checkout, create, push, delete, track remote branches, stash (save/pop/drop) from the panel
- **Pull Request management** — create PRs, merge (squash/merge/rebase), toggle GitHub auto-merge — all without opening the browser
- **Conflict resolution** — during merge/rebase, lists conflicted files, diff preview, one-click ours/theirs, open in IDE, continue/abort
- **Native notifications** — system notifications when the remote has new commits, when a repo becomes dirty, when unfetched work appears
- **Bilingual UI** — Turkish + English toggle in the header, persisted in config

---

## Install

### macOS (Apple Silicon)

1. Grab `pb-panel_x.y.z_aarch64.dmg` from [Releases](https://github.com/By-Taika/pb-panel/releases)
2. Open the DMG and drag `pb-panel.app` into `Applications`
3. On first launch, if Gatekeeper warns "unidentified developer":
   - **System Settings → Privacy & Security → Open Anyway**
   - Or from terminal: `xattr -d com.apple.quarantine /Applications/pb-panel.app`

*(Ad-hoc signed, not notarised — normal for open-source Tauri apps. One-time approval, then runs like any other app.)*

### Windows 10/11

1. Grab `pb-panel_x.y.z_x64_en-US.msi` from [Releases](https://github.com/By-Taika/pb-panel/releases)
2. Double-click the MSI
3. If SmartScreen warns, **More info → Run anyway**
4. Launch "pb-panel" from the Start menu

### Auto-updates

Starting v0.8, the app checks for new releases automatically:
- Once at launch, then every 6 hours
- When a new release is found, a modal asks you to install
- Download + signature verification + install + relaunch — all automatic
- You can postpone; the check runs again 6 hours later

> First install is manual. Subsequent updates are handled by the auto-updater.

---

## First-run wizard

A 3-step wizard runs the first time you launch the app:

### 1. General

**Base folder** — the root that contains all your repo folders. Examples:
- `/Users/<you>/Projects`
- `/Users/<you>/Dev`
- `C:\Users\<you>\source`

Sub-folders become categories, and the git repos under them get scanned.

### 2. Accounts

One entry per GitHub identity:
- **Label** — the name shown in the UI (e.g. "Work", "Personal")
- **Username** — your GitHub handle (used when building clone URLs)
- **Token** — a [Personal Access Token](https://github.com/settings/tokens) with the `repo` scope. Stored in the OS keychain, never on disk.

### 3. Categories

Choose which sub-folders of your base directory should appear and which account each one belongs to. The **"Autofill from base folder"** button scans and adds everything it finds.

When you're done, the config is written to the OS-standard app config directory (path shown in Settings).

To change anything later, click **⚙ Settings** top-right, or use the tray menu.

---

## Main screen

```
┌─ Header ────────────────────────────────────────────────┐
│ pb-panel · <base folder>  [Account A] [Account B]  ↻ 🌐 │
├─ Sidebar ──┬─ Main ──────────────────────────────────── ┤
│ All    42  │ Category A (8)                             │
│ ─────      │                                            │
│ Cat. A  8  │ ▸ Sub-folder (3)                           │
│ Cat. B  4  │ ┌────────┐┌────────┐┌────────┐             │
│ Cat. C 22  │ │ repo-a ││ repo-b ││ repo-c │             │
│ Cat. D  8  │ │ main ⎇ ││ main ⎇ ││ dev  ⎇ │             │
│            │ │ clean  ││ 3 dirty││ ↯ 2    │             │
│            │ │ Pull   ││ Pull   ││ Pull   │             │
│            │ └────────┘└────────┘└────────┘             │
└────────────┴────────────────────────────────────────────┘
```

Each card has **Pull** / **Fetch** / **Open** (opens in IDE) / **ⓘ** (detail drawer) buttons.

**↯ N** chip = remote has unfetched new commits on N branches. Hover shows branch names. The **🌐 language toggle** in the header flips the whole UI between Turkish and English.

---

## Detail drawer — four tabs

Click **ⓘ** on any card. A side drawer opens with four tabs:

### 1. Overview

- **GitHub** — stars · open issues · default branch · visibility · language · `pushed_at`
- **Local state** — branch · dirty file count · ahead/behind · remote updates · account
- **Commit history** — last 30 commits

### 2. Branches (new in v0.8)

Local + remote branch list.

**Local branch row:**
- ● coloured marker → current branch
- `⎇ <name>` → branch name
- `↔ origin/<name>` → upstream tracking
- `↑N` (green) / `↓N` (amber) → ahead / behind counts
- Last commit subject + relative time

**Per-row actions:**
- `→` — checkout (blocked if working tree is dirty; commit or stash first)
- `↑` — push (sets upstream automatically if missing)
- `×` — delete (confirm dialog)

**New branch** — "+ New" button → name it → create + checkout from HEAD in one step.

**Remote branches** — lists untracked remote branches. Clicking "checkout" creates `feature/x` locally tracking `origin/feature/x`.

**Stash:**
- "Stash changes" — runs `stash push -m "pb-panel ..."` on dirty files
- Each stash row: `pop` (apply + remove) or `×` (drop, confirm'd)

### 3. PR (Pull Requests — new in v0.8)

Open PRs list from the GitHub API. For closed ones, open on GitHub.

**Each PR row:** `#N · title · author · last updated · draft badge (if any)`

**Expanded:**
- head/base branch names
- mergeable state (`clean`, `dirty`, `unknown`)
- auto-merge on/off
- Description (markdown, collapsible)
- **Merge now** — pick squash/merge/rebase; confirm'd; disabled if conflicts exist
- **Enable auto-merge** — GitHub's native auto-merge via GraphQL. Merges once all checks pass.
- **Disable auto-merge** — if currently on
- **Open on GitHub** — for detailed review in browser

**Create PR** — "+ New PR" button:
- head/base branch (default: current branch → `main`)
- title + markdown body
- draft checkbox
- "Create PR" → toast with the new PR number

### 4. Conflicts (new in v0.8)

If a merge or rebase runs into conflicts, this tab shows a red badge.

**Top banner** — shows the active operation and file count:
- **✓ Continue** — once all files resolved, runs `git commit --no-edit` to finalize
- **× Abort** — `git merge --abort` / `git rebase --abort`, confirm'd (changes reverted)

**File list:**
- Each file shows its git status code (UU, DD, AA, etc.)
- Click to expand the diff preview (monospaced)
- **← use ours** — `git checkout --ours <file>` + auto `git add`
- **use theirs →** — `git checkout --theirs <file>` + auto `git add`
- **Open in IDE** — for detailed manual resolution

If nothing is conflicted: "No conflicts, repo is clean."

---

## Menubar tray

- **Left click** — toggle main window
- **Right click** menu:
  - **Show panel**
  - **Re-scan** (on top of the 30-second auto-scan)
  - **Settings…**
  - **Quit**
- Tooltip: `42 repos · 3 dirty · 2 behind`

---

## Native notifications (new in v0.8)

On first launch the app asks for notification permission. Once granted, the background scan (every 60s) fires a system notification when:

| Event | Example notification |
|---|---|
| Remote has new commits (behind grew) | "New commits — `rani-platform` is 3 commits behind. Pull?" |
| Clean repo became dirty | "Uncommitted changes — `rani-lms` has 4 changed files, not yet committed." |
| Unfetched remote updates | "Remote updated — `rani-envanter` has new work upstream (feature/xyz, main)." |

Nothing fires on the first scan (quiet cold start). Only state changes trigger.

Disable at OS level: macOS Settings → Notifications → pb-panel → revoke permission.

---

## Build from source

### Requirements

- Rust 1.75+ ([rustup](https://rustup.rs))
- Node 20+ ([nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools + WebView2 (built into Windows 11)

### Dev mode

```bash
git clone https://github.com/By-Taika/pb-panel.git
cd pb-panel
npm install
npm run tauri:dev
```

Vite dev server runs on `http://localhost:5555`, Rust host loads it into a webview. Hot-reload on both sides.

### Release build

```bash
npm run tauri:build
```

Artifacts:
- macOS app: `src-tauri/target/release/bundle/macos/pb-panel.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/pb-panel_*.dmg`
- Windows MSI: `src-tauri/target/release/bundle/msi/pb-panel_*.msi`

### Auto-updater signing (for maintainers)

From v0.8 onward, releases are signed with minisign. First-time setup:

```bash
# 1. Generate a key pair (do this once, don't lose it!)
npx tauri signer generate -w ~/.tauri/pb-panel.key --ci

# 2. Copy the public key contents
cat ~/.tauri/pb-panel.key.pub
# → paste into src-tauri/tauri.conf.json under plugins.updater.pubkey

# 3. Copy the private key contents into a GitHub repo secret
cat ~/.tauri/pb-panel.key
# → Repo Settings → Secrets and variables → Actions → New secret:
#   TAURI_SIGNING_PRIVATE_KEY         = private key contents (base64)
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (empty if the key has no password)
```

Release flow: `git tag v0.X.0 && git push --tags` → GitHub Actions `.github/workflows/release.yml` runs → macos-14 arm64 + windows-latest builds → signs → publishes `latest.json` manifest with the DMG/MSI. Existing users get the auto-update signal.

> **⚠ If the private key is lost:** you'll have to generate a new pair; existing users keep accepting old signed packages but reject newer ones (public key mismatch). Back it up.

### Regenerating icons

```bash
# edit icon-source.svg, then:
qlmanage -t -s 1024 -o . icon-source.svg           # macOS: SVG → PNG
npx @tauri-apps/cli icon icon-source.svg.png       # all target sizes
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
| Config | JSON file, atomic write (`.tmp + rename`) |
| Auto-updater | `tauri-plugin-updater` v2 + minisign |
| Notifications | `tauri-plugin-notification` (native OS) |
| i18n | Lightweight homemade React context (TR + EN) |

Rust shells out to `git` rather than linking libgit2 — anything your local `git` can do, pb-panel can do. No extra dependencies, no version skew.

### File layout

```
pb-panel/
├── src-tauri/
│   ├── Cargo.toml                       ← Rust dependencies
│   ├── tauri.conf.json                  ← Tauri config (updater, bundle, window)
│   ├── capabilities/default.json        ← Plugin permissions
│   └── src/
│       ├── lib.rs                       ← Entry, plugin setup, all #[tauri::command]
│       ├── config.rs                    ← JSON config read/write
│       ├── tokens.rs                    ← Keychain integration
│       ├── repo.rs                      ← Repo scan + status
│       ├── git_ops.rs                   ← pull/fetch/clone/open-in-ide
│       ├── branches.rs                  ← (v0.8) branches + stash
│       ├── conflicts.rs                 ← (v0.8) merge conflict handling
│       ├── prs.rs                       ← (v0.8) PR CRUD + auto-merge
│       └── github.rs                    ← Basic GitHub REST (user, PR list, repo meta)
├── client/src/
│   ├── App.tsx                          ← Main layout + updater + notification hook
│   ├── lib/
│   │   ├── api.ts                       ← Typed Tauri invoke wrappers
│   │   ├── types.ts                     ← TypeScript types
│   │   ├── updater.ts                   ← (v0.8) checkForUpdate + installUpdate
│   │   ├── notifications.ts             ← (v0.8) diffAndNotify + permission
│   │   └── i18n.tsx                     ← (v0.8) TR/EN context + useT hook
│   └── components/
│       ├── Header.tsx, Sidebar.tsx, RepoCard.tsx, CloneDialog.tsx, SettingsPanel.tsx
│       ├── RepoDrawer.tsx               ← 4-tab detail panel
│       ├── BranchesPanel.tsx            ← (v0.8)
│       ├── PullRequestsPanel.tsx        ← (v0.8)
│       ├── ConflictsPanel.tsx           ← (v0.8)
│       └── UpdateModal.tsx              ← (v0.8) auto-update install modal
└── .github/workflows/release.yml        ← macOS arm64 + Windows x64 CI
```

---

## Privacy

- Tokens are **always** stored in the OS keychain (Keychain / Credential Manager / libsecret)
- No telemetry, no backend, no network calls except direct GitHub API requests using your own token
- Clone URLs have tokens masked in logs (`ghp_***`); tokens never leak to log files
- Auto-updater talks only to GitHub releases (`https://github.com/By-Taika/pb-panel/releases/...`); no other server
- Downloaded packages are signed with minisign; tampered packages are detected and refused

---

## Roadmap

v0.8 brings the app to "cockpit" level. What's next:

- **CI status display** — pass/fail/pending badges on PR list rows
- **Pre-commit hook management** — toggle husky/lefthook from inside the panel
- **Multi-repo bulk operations** — fetch N selected repos, switch them all to the same branch
- **Integration tests + release automation** — e2e smoke tests on every PR
- **GH Actions log viewer** — read the last run's log from the panel without a browser

Contributions welcome: open an issue, send a PR, request a feature.

---

## Support

- **Bug / feature request** — [GitHub issues](https://github.com/By-Taika/pb-panel/issues)
- **PR** — small, focused changes against `main`
- **Security issue** — private issue or direct maintainer contact

---

## License

MIT — see [LICENSE](LICENSE).

Built with Tauri · Open source, everyone welcome · Issues and PRs accepted.

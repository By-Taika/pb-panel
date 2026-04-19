# pb-panel

**Yerel makinendeki git repolarını tek bakışta yöneten hafif bir masaüstü paneli.**
Birden fazla GitHub kimliğiyle (kişisel, şirket, org) çalışan geliştiriciler için.

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![built_with](https://img.shields.io/badge/built_with-Tauri_v2-orange)

---

## Bu ne işe yarar?

Bir klasörün (`~/Projects`, `~/Dev` gibi) altında düzinelerce git reposu tutuyor musun?
Hangisi dirty, hangisi behind origin, hangi branch'tesin, son commit ne zamandı… terminal açıp `git status; git log -1` yazmak yerine **hepsine aynı anda göz at, tek tıkla pull et, VS Code'da / IntelliJ'de aç.**

pb-panel bu iş için native bir macOS/Windows uygulaması:

- 🔍 **Tara** — seçtiğin base klasörün altındaki tüm repoları otomatik bulur (1-2 seviye derinlik)
- 📊 **Durum** — branch · dirty file sayısı · ahead/behind origin · son commit (yazar + süre)
- ⬇️ **Toplu pull** — behind olanları tek tıkla günceller
- 🪶 **Menubar tray** — pencere kapalıyken de dirty/behind sayısını gösterir
- 🐙 **GitHub entegrasyonu** — açık PR'lar + repo meta (stars, issues, default branch, pushed_at)
- 📜 **Commit geçmişi** — her repo için son 30 commit'i drawer'da
- ⚡ **Clone** — panel içinden `owner/repo` yaz, doğru hesabın token'ıyla clone eder
- 🔐 **Keychain** — token'lar düz dosyada değil, macOS Keychain'de (Windows'ta Credential Manager)
- 🏢 **Çoklu hesap** — kaç GitHub kimliğin varsa tanımla; her kategori bir hesaba bağlı

---

## Kurulum

### macOS (Apple Silicon)

1. [Releases](https://github.com/By-Taika/pb-panel/releases) sayfasından `pb-panel_x.y.z_*.dmg` indir
2. DMG'yi aç, `pb-panel.app`'i `Applications`'a sürükle
3. İlk açılışta Gatekeeper "Apple kimliği doğrulanamadı" derse:
   - **Ayarlar → Gizlilik ve Güvenlik → Yine de aç**
   - Ya da terminalden: `xattr -d com.apple.quarantine /Applications/pb-panel.app`

*(Ad-hoc imzalı, notarize edilmemiş — kendi makinende her şey çalışır, sadece ilk açılışta bu onay gerekir.)*

### Windows 10/11

1. [Releases](https://github.com/By-Taika/pb-panel/releases) sayfasından `pb-panel_x.y.z_x64_en-US.msi` indir
2. MSI'yı çift tıkla → kurulum
3. SmartScreen uyarısı çıkarsa **Ek bilgiler → Yine de çalıştır**
4. Başlat menüsünden "pb-panel" aç

---

## İlk çalıştırma

İlk açılışta 3 adımlı bir sihirbaz seni karşılar:

### 1️⃣ Genel
**Base klasör** — repolarının olduğu kök klasörü seç. Örnekler:
- `/Users/<isim>/ProjectBase`
- `/Users/<isim>/Dev`
- `C:\Users\<isim>\source`

Alt klasörler kategori olur, onların altındaki git repoları da taranır.

### 2️⃣ Hesaplar
Her GitHub kimliği için bir giriş ekle:
- **Etiket** — UI'da görünen ad (ör. "Kişisel", "Şirket")
- **Username** — GitHub kullanıcı adın (clone URL'leri için kullanılır)
- **Token** — [Personal Access Token](https://github.com/settings/tokens) (`repo` scope). Keychain'e yazılır, asla düz dosyaya değil.

### 3️⃣ Kategoriler
Base klasörünün altındaki hangi klasörlerin gösterileceğini ve hangi hesaba bağlı olduğunu seç. **"Base klasörden otomatik doldur"** butonu mevcut klasörleri tarayıp listeye ekler.

Bittiğinde ayarlar `~/Library/Application Support/com.codecrew.pbpanel/config.json`'a yazılır (Windows: `%APPDATA%\com.codecrew.pbpanel\config.json`).

Sonradan değiştirmek için sağ üstte ⚙ Ayarlar butonu ya da menubar tray → Ayarlar….

---

## Ekran akışı

```
┌─ Header ────────────────────────────────────────────────┐
│ pb-panel · ProjectBase   [hesap1] [hesap2]  ↻ + ⚙       │
├─ Sidebar ──┬─ Main ─────────────────────────────────────┤
│ Tümü    42 │ CodeCrew (8)                               │
│ ─────      │                                            │
│ Rani     3 │ ▸ Web Projeleri (3)                        │
│ CodeCrew 8 │ ┌────────┐┌────────┐┌────────┐             │
│ KRN      4 │ │ repo-a ││ repo-b ││ repo-c │             │
│ Fordevo  5 │ │ main ⎇ ││ main ⎇ ││ dev  ⎇ │             │
│ ByTaika 22 │ │ clean  ││ 3 dirty││ ↓2     │             │
│            │ │ Pull   ││ Pull   ││ Pull   │             │
│            │ └────────┘└────────┘└────────┘             │
└────────────┴────────────────────────────────────────────┘
```

Bir karttaki **ⓘ** butonuna basınca sağdan drawer açılır:
- GitHub meta (stars · issues · default branch · language · pushed_at)
- Açık PR'lar (tıklanınca browser'da açılır)
- Son 30 commit

---

## Menubar tray

- Sol click: pencereyi aç/gizle
- Sağ click:
  - **Paneli göster**
  - **Yeniden tara** (30sn'lik otomatik taramanın dışında manuel trigger)
  - **Ayarlar…**
  - **Çıkış**
- Tooltip: `42 repo · 3 dirty · 2 behind`

---

## Kaynak koddan build

### Bağımlılıklar
- Rust 1.75+ ([rustup](https://rustup.rs))
- Node 20+ ([nvm](https://github.com/nvm-sh/nvm) ya da [fnm](https://github.com/Schniz/fnm))
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools + WebView2 (Win11'de built-in)

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
Çıktılar:
- macOS: `src-tauri/target/release/bundle/macos/pb-panel.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/pb-panel_*.dmg`
- Windows: `src-tauri/target/release/bundle/msi/pb-panel_*.msi`

### İkon yenileme
```bash
# icon-source.svg'yi düzenle, sonra:
qlmanage -t -s 1024 -o . icon-source.svg           # macOS'te SVG→PNG
npx @tauri-apps/cli icon icon-source.svg.png       # tüm boyutları üret
```

---

## Mimari (kısa)

| Katman | Teknoloji |
|---|---|
| UI | React 18 + Vite 5 + TailwindCSS 3 |
| Pencere + IPC | Tauri v2 (Rust shell) |
| Git çağrıları | `tokio::process::Command("git", …)` |
| GitHub API | `reqwest` + per-hesap token |
| Token | `keyring` crate (macOS Keychain / Windows Credential Manager / libsecret) |
| Config | JSON dosyası, atomic write via `.tmp + rename` |

Tauri backend sadece git komutlarını shell'den çağırır — libgit2 vs. bağımlılık yok, makinendeki `git` neyi yapabiliyorsa panel de onu yapar.

---

## Gizlilik

- Token'lar **her zaman** OS keychain'de (Keychain.app / Credential Manager / libsecret) tutulur
- Hiçbir yere telemetri gönderilmez, hiçbir arka uç yoktur — pb-panel tamamen lokaldir
- GitHub API çağrıları sadece seçtiğin hesabın token'ıyla `api.github.com`'a gider
- Clone URL'leri log'a yazılırken token'lar regex ile maskelenir (`ghp_***`)

---

## Lisans

MIT — bkz. [LICENSE](LICENSE).

Tauri kullanılarak üretildi · Katkılar + issue'lar memnuniyetle karşılanır.

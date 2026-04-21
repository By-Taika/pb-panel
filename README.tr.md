# pb-panel

**Birden fazla GitHub hesabı için yerel git repolarını tek panelden yöneten desktop uygulaması.**

Türkçe · [🇬🇧 English README](README.md)

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![built_with](https://img.shields.io/badge/built_with-Tauri_v2-orange)
![version](https://img.shields.io/badge/version-0.8.0-blueviolet)

---

## Ne işe yarar

Eğer tek bir klasörün altında onlarca git repon varsa (`~/Projects`, `~/Dev`, `~/ProjectBase` gibi), pb-panel her repo için ayrı terminal açmak yerine hepsinin durumunu tek ekranda gösterir: kirli dosya, origin'den geride/ileride mi, hangi branch'teyiz, son commit ne zaman atıldı.

Native macOS/Windows uygulaması (Tauri v2 — Electron değil, arka plan server'ı yok). v0.8 ile artık sadece **gözlem** değil, **aksiyon paneli**:

### Temel özellikler

- **Tarama** — seçtiğin ana klasörün altındaki her git repo'yu bir seviye alt-klasöre kadar otomatik bulur
- **Tek bakışta durum** — branch · kirli dosya sayısı · ahead/behind · son commit (yazar + göreli zaman)
- **Remote güncelleme ipucu** — `git ls-remote` ile fetch yapmadan remote'ta yeni ne var görür
- **Toplu pull** — behind olan repo'ları tek tıkla günceller
- **Tray ikon** — pencere kapalıyken bile kirli/behind sayısını menubar'dan gösterir
- **Clone** — `owner/repo` yaz, doğru hesap token'ını seçer, doğru kategoriye indirir
- **Keychain-backed token saklama** — token asla düz dosyada tutulmaz
- **Çoklu hesap** — iş + kişisel hesapları yan yana tutabilirsin

### Yeni (v0.8) — kokpit özellikleri

- **Auto-updater** — yeni sürüm çıkınca panel kendisi haber verir + indirir + kurar + yeniden başlar
- **Branch yönetimi** — checkout, create, push, delete, remote branch tracking, stash (save/pop/drop) hepsi panelden
- **Pull Request yönetimi** — PR oluştur, merge et (squash/merge/rebase), auto-merge aç/kapa, hepsini tarayıcı açmadan panelden
- **Çakışma (conflict) çözümü** — merge/rebase sırasında çakışan dosyaları listeler, ours/theirs tek tıkla, IDE'de aç, continue/abort
- **Native bildirimler** — remote'ta yeni commit belirdiğinde, repo kirlendiğinde, fetch edilmemiş iş olduğunda sistem bildirimi

---

## Kurulum

### macOS (Apple Silicon)

1. [Releases](https://github.com/By-Taika/pb-panel/releases) sayfasından `pb-panel_x.y.z_aarch64.dmg` dosyasını indir
2. DMG'yi aç, `pb-panel.app`'i `Applications`'a sürükle
3. İlk açılışta Gatekeeper "kaynağı belirsiz" uyarısı çıkarsa:
   - **Sistem Ayarları → Gizlilik & Güvenlik → Yine de Aç**
   - Veya terminalden: `xattr -d com.apple.quarantine /Applications/pb-panel.app`

*(Ad-hoc imzalı, notarize edilmemiş — açık kaynak Tauri uygulamaları için normal. Bir kez onay verirsin, sonra başka uygulamalar gibi çalışır.)*

### Windows 10/11

1. [Releases](https://github.com/By-Taika/pb-panel/releases) sayfasından `pb-panel_x.y.z_x64_en-US.msi` dosyasını indir
2. MSI'ya çift tıkla, kurulum sihirbazını takip et
3. SmartScreen uyarısı çıkarsa **Daha fazla bilgi → Yine de çalıştır**
4. Start menüden "pb-panel" ile başlat

### Sürüm güncellemeleri (otomatik)

v0.8'den itibaren panel kendisi yeni sürüm var mı kontrol eder:
- Her açılışta bir kez, sonra 6 saatte bir GitHub releases'e bakar
- Yeni sürüm varsa modal gösterir: "Yeni sürüm var, indir ve yükle" butonu
- Onayladıktan sonra indirme + imza doğrulama + yükleme + yeniden başlatma otomatik
- İstemezsen "Sonra" deyip kapatabilirsin, bir sonraki periyodik kontrolde tekrar sorar

> İlk kurulum manuel indirme gerektiriyor, sonraki sürümleri güncelleyici hallediyor.

---

## İlk çalıştırma sihirbazı

İlk açılışta 3 adımlık bir sihirbaz çıkar:

### 1. Genel

**Ana klasör** — tüm repo klasörlerini barındıran kök. Örnekler:
- `/Users/<sen>/Projects`
- `/Users/<sen>/Dev`
- `C:\Users\<sen>\source`

Alt klasörler kategori olur, onların altındaki git repoları taranır.

### 2. Hesaplar

Her GitHub kimliği için bir giriş ekle:
- **Etiket** — UI'da görünecek isim (örn. "İş", "Kişisel")
- **Kullanıcı adı** — GitHub kullanıcı adın (clone URL'i oluşturulurken kullanılır)
- **Token** — `repo` yetkili [Personal Access Token](https://github.com/settings/tokens). OS keychain'e yazılır, diskte düz halde tutulmaz.

### 3. Kategoriler

Ana klasörün hangi alt-klasörleri listelensin, her biri hangi hesaba bağlı — seç. **"Ana klasörden otomatik doldur"** butonu klasörü tarar, bulduklarını ekler.

Bitince config, OS'un standart app config dizinine yazılır (tam yolu Ayarlar'dan görebilirsin).

Sonradan değiştirmek için sağ üstteki **⚙ Ayarlar** butonu veya tray menü.

---

## Ana ekran

```
┌─ Header ────────────────────────────────────────────────┐
│ pb-panel · <ana klasör>  [Hesap A] [Hesap B]   ↻  Clone │
├─ Sidebar ──┬─ Ana alan ─────────────────────────────────┤
│ Hepsi  42  │ Kategori A (8)                             │
│ ─────      │                                            │
│ Kat. A  8  │ ▸ Alt-klasör (3)                           │
│ Kat. B  4  │ ┌────────┐┌────────┐┌────────┐             │
│ Kat. C 22  │ │ repo-a ││ repo-b ││ repo-c │             │
│ Kat. D  8  │ │ main ⎇ ││ main ⎇ ││ dev  ⎇ │             │
│            │ │ temiz  ││ 3 dirty││ ↯ 2    │             │
│            │ │ Pull   ││ Pull   ││ Pull   │             │
│            │ └────────┘└────────┘└────────┘             │
└────────────┴────────────────────────────────────────────┘
```

Her kartta **Pull** / **Fetch** / **Open** (IDE'de açar) / **ⓘ** (detay drawer) butonları.

**↯ N** rozeti = remote'da N farklı branch'te fetch edilmemiş yeni commit var. Hover'da branch isimleri görünür.

---

## Detay drawer'ı — 4 sekme

Kart üzerinde **ⓘ** tıklayınca sağdan drawer açılır, içinde 4 sekme:

### 1. Genel bakış

- **GitHub** — stars · açık issue · default branch · visibility · dil · `pushed_at`
- **Lokal durum** — branch · kirli dosya sayısı · ahead/behind · remote updates · hesap
- **Commit history** — son 30 commit

### 2. Branches (yeni v0.8)

Yerel + remote branch listesi.

**Yerel branch satırında:**
- ● işareti + renkli → aktif branch
- `⎇ <isim>` → branch ismi
- `↔ origin/<isim>` → upstream takibi
- `↑N` (yeşil) / `↓N` (amber) → ahead / behind sayıları
- Son commit mesajı + göreli zaman

**Aksiyonlar (her satırda):**
- `→` — checkout (dirty working tree varsa engellenir, önce commit/stash lazım)
- `↑` — push (upstream yoksa `push -u origin <branch>` yapar)
- `×` — delete (confirm dialog'lu)

**Yeni branch** — "+ Yeni" butonu → isim yaz → HEAD'den create + checkout tek adımda.

**Remote branch listesi** — tracking yapılmamış remote branch'leri listeler. "checkout" tıklayınca `origin/feature/x` → yerel `feature/x` olarak oluşturur ve geçer.

**Stash:**
- "Stash değişiklikleri" — kirli dosyaları `stash push -m "pb-panel ..."` ile saklar
- Her stash için `pop` (uygula + sil) veya `×` (direkt sil, confirm'li)

### 3. PR (Pull Requests — yeni v0.8)

Açık PR listesi — GitHub API'dan. Kapalıları görmek için GitHub'da aç.

**Her PR satırı:** `#N · başlık · yazar · son güncelleme · draft rozeti (varsa)`

**Genişletince:**
- head/base branch isimleri
- mergeable durumu (`temiz`, `çakışma`, `hesaplanıyor`)
- auto-merge aktif mi
- Açıklama (markdown, gizli, "Açıklama" ile göster)
- **Merge butonu** — squash/merge/rebase seçilebilir. Confirm dialog'lu. Çakışma varsa devre dışı.
- **Auto-merge aç** — GitHub'ın native auto-merge'ü GraphQL API üzerinden. Tüm check'ler geçince PR otomatik merge olur.
- **Auto-merge iptal** — zaten aktifse iptal butonu
- **GitHub'da aç** — tarayıcıda detaylı incelemek için

**Yeni PR oluşturma** — "+ Yeni PR" butonu:
- head ve base branch (default: aktif branch → `main`)
- başlık + markdown body
- draft checkbox
- "PR oluştur" tıkla, sonuç toast'ta PR numarasıyla.

### 4. Çakışmalar (conflicts — yeni v0.8)

Merge/rebase sırasında çakışma çıkarsa bu sekme kırmızı rozet gösterir.

**Üst banner** — aktif işlemi ve dosya sayısını söyler:
- **✓ Devam** — tüm dosyalar çözülünce, `git commit --no-edit` ile finalize eder
- **× İptal** — `git merge --abort` / `git rebase --abort`, confirm'li (değişiklikler geri alınır)

**Dosya listesi:**
- Her dosyanın yanında status code (UU, DD, AA, vs.)
- Tıklayınca diff preview açılır (monospaced)
- **← ours seç** — `git checkout --ours <file>` + auto `git add`
- **theirs seç →** — `git checkout --theirs <file>` + auto `git add`
- **IDE'de aç** — detaylı editör çözümü için

Hiç çakışma yoksa: "Çakışma yok, repo temiz."

---

## Tray ikon (menubar)

- **Sol tık** — ana pencereyi aç/kapat
- **Sağ tık menüsü:**
  - **Paneli göster**
  - **Yeniden tara** (30 saniyelik otomatik taramaya ek olarak)
  - **Ayarlar…**
  - **Çıkış**
- Tooltip: `42 repos · 3 dirty · 2 behind`

---

## Native bildirimler (yeni v0.8)

pb-panel ilk açılışta bildirim izni ister. Onayladıktan sonra arka plan taraması (60 saniyede bir) sırasında şu durumlarda sistem bildirimi gönderir:

| Olay | Örnek bildirim |
|---|---|
| Remote'ta yeni commit (behind arttı) | "Yeni commit var — `rani-platform` 3 commit geride. Pull etmek ister misin?" |
| Temiz repo kirlendi | "Uncommitted değişiklik — `rani-lms` içinde 4 dosya değişmiş, henüz commit edilmemiş." |
| Remote updates belirdi | "Remote güncellendi — `rani-envanter` için upstream'de yeni iş var (feature/xyz, main)." |

İlk taramada bildirim gitmez (cold start için sessiz). Sadece durum değişikliklerinde tetiklenir.

Kapatmak istersen: macOS Ayarlar → Bildirimler → pb-panel → İzinleri kaldır.

---

## Kaynaktan derleme

### Gereksinimler

- Rust 1.75+ ([rustup](https://rustup.rs))
- Node 20+ ([nvm](https://github.com/nvm-sh/nvm) veya [fnm](https://github.com/Schniz/fnm))
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio Build Tools + WebView2 (Windows 11'de built-in)

### Dev mode

```bash
git clone https://github.com/By-Taika/pb-panel.git
cd pb-panel
npm install
npm run tauri:dev
```

Vite dev server `http://localhost:5555`'te çalışır, Rust host onu webview'e yükler. Rust tarafında kod değişikliği yapınca hot-reload için rebuild edilir.

### Release build

```bash
npm run tauri:build
```

Çıktılar:
- macOS app: `src-tauri/target/release/bundle/macos/pb-panel.app`
- macOS DMG: `src-tauri/target/release/bundle/dmg/pb-panel_*.dmg`
- Windows MSI: `src-tauri/target/release/bundle/msi/pb-panel_*.msi`

### Auto-updater imzalama (maintainer'lar için)

v0.8 ile release'ler minisign ile imzalanır. İlk kez setup için:

```bash
# 1. Key çifti üret (bir kez, sonra kaybetme!)
npx tauri signer generate -w ~/.tauri/pb-panel.key --ci

# 2. Public key içeriğini kopyala
cat ~/.tauri/pb-panel.key.pub
# → bunu src-tauri/tauri.conf.json'daki plugins.updater.pubkey'e yapıştır

# 3. Private key içeriğini GitHub repo secrets'a ekle
cat ~/.tauri/pb-panel.key
# → Repo Settings → Secrets and variables → Actions → New secret:
#   TAURI_SIGNING_PRIVATE_KEY       = private key içeriği (base64)
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (boş bırak; key'de şifre yoksa)
```

Release akışı: `git tag v0.X.0 && git push --tags` → GitHub Actions `.github/workflows/release.yml` tetiklenir, iki platform (macos-14 arm64 + windows-latest) için build + imza + `latest.json` manifest + release yayınlar. Mevcut kullanıcıların paneli otomatik güncelleme sinyalini alır.

> **⚠ Private key kaybolursa:** yeni bir key çifti üretmek zorunda kalırsın, mevcut kullanıcılar eski imzalı paketleri kabul eder ama yenileri reddeder (public key değişmiş olur). O yüzden yedekle.

### İkon yeniden üretimi

```bash
# icon-source.svg'yi düzenle, sonra:
qlmanage -t -s 1024 -o . icon-source.svg           # macOS: SVG → PNG
npx @tauri-apps/cli icon icon-source.svg.png       # tüm boyutlar için ikon üret
```

---

## Mimari (özet)

| Katman | Teknoloji |
|---|---|
| UI | React 18 + Vite 5 + TailwindCSS 3 |
| Pencere + IPC | Tauri v2 (Rust host) |
| Git işlemleri | `tokio::process::Command("git", …)` |
| GitHub API | `reqwest` + hesap bazlı token |
| Token saklama | `keyring` crate (Keychain / Credential Manager / libsecret) |
| Config | JSON, atomic write (`.tmp + rename`) |
| Auto-updater | `tauri-plugin-updater` v2 + minisign |
| Bildirimler | `tauri-plugin-notification` (native OS) |

Rust tarafı libgit2 linklemek yerine `git` binary'sini çağırıyor — yani yerel `git`'in yaptığı her şeyi pb-panel de yapabilir, extra dependency yok, versiyon uyumsuzluğu yok.

### Dosya haritası

```
pb-panel/
├── src-tauri/
│   ├── Cargo.toml                       ← Rust dependencies
│   ├── tauri.conf.json                  ← Tauri config (updater, bundle, window)
│   ├── capabilities/default.json        ← Plugin izinleri
│   └── src/
│       ├── lib.rs                       ← Entry point, plugin setup, tüm #[tauri::command]
│       ├── config.rs                    ← JSON config okuma/yazma
│       ├── tokens.rs                    ← Keychain entegrasyonu
│       ├── repo.rs                      ← Repo tarama + status
│       ├── git_ops.rs                   ← pull/fetch/clone/open-in-ide
│       ├── branches.rs                  ← (v0.8) branch + stash
│       ├── conflicts.rs                 ← (v0.8) merge conflict handling
│       ├── prs.rs                       ← (v0.8) PR CRUD + auto-merge
│       └── github.rs                    ← Basit GitHub REST çağrıları (user, PR list, repo meta)
├── client/src/
│   ├── App.tsx                          ← Ana layout + updater check + notification hook
│   ├── lib/
│   │   ├── api.ts                       ← Tauri invoke wrapper'ları (tek-tipte)
│   │   ├── types.ts                     ← TypeScript type tanımları
│   │   ├── updater.ts                   ← (v0.8) checkForUpdate + installUpdate
│   │   └── notifications.ts             ← (v0.8) diffAndNotify + permission yönetimi
│   └── components/
│       ├── Header.tsx, Sidebar.tsx, RepoCard.tsx, CloneDialog.tsx, SettingsPanel.tsx
│       ├── RepoDrawer.tsx               ← 4 sekmeli detay panel
│       ├── BranchesPanel.tsx            ← (v0.8)
│       ├── PullRequestsPanel.tsx        ← (v0.8)
│       ├── ConflictsPanel.tsx           ← (v0.8)
│       └── UpdateModal.tsx              ← (v0.8) auto-update indirme modal'ı
└── .github/workflows/release.yml        ← macOS arm64 + Windows x64 CI
```

---

## Gizlilik

- Token'lar **her zaman** OS keychain'inde saklanır (Keychain / Credential Manager / libsecret)
- Telemetri yok, backend yok, kendi token'ınla yaptığın GitHub API isteği dışında ağ trafiği yok
- Clone URL'lerindeki token'lar loglardan maskelenir (`ghp_***`), log dosyalarına sızmaz
- Auto-updater sadece GitHub releases'a bakar (`https://github.com/By-Taika/pb-panel/releases/...`); başka bir sunucuyla konuşmaz
- İndirilen paketler minisign ile imzalıdır, tampered paket tespit edilir ve yüklenmez

---

## Yol haritası

v0.8 ile panel "kokpit" seviyesine geldi. Sonrası için düşünülen:

- **CI status gösterimi** — PR listesinde "checks passing / failing / pending" rozetleri
- **Pre-commit hook yönetimi** — husky/lefthook gibi araçlar için panel içi aç/kapa
- **Multi-repo bulk operations** — seçili 5 repo'yu aynı anda fetch et, aynı branch'e geç
- **Integration tests + release automation** — her PR'da e2e smoke test
- **GH Actions log görüntüleme** — son run'un log'unu panel içinden oku (beklemesiz feedback)
- **i18n** — EN + TR toggle (şu an Türkçe baskın)

Katkı açık: issue aç, PR yolla, feature iste.

---

## Destek

- **Bug / feature request** — [GitHub issues](https://github.com/By-Taika/pb-panel/issues)
- **PR** — `main` branch'e ufak, odaklı değişiklikler tercih edilir
- **Güvenlik problemi** — private issue veya maintainer'la direkt iletişim

---

## Lisans

MIT — detaylar [LICENSE](LICENSE) dosyasında.

Built with Tauri · Açık kaynak, herkese açık · Issue ve PR'lar karşılanır.

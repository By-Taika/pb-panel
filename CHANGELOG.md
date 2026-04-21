# Changelog

Bu dosya pb-panel'in her sürümünde neyin değiştiğini listeler. Format [Keep a Changelog](https://keepachangelog.com/) temelli, sürüm numaraları [SemVer](https://semver.org/).

## [0.8.2] — 2026-04-21

v0.8.1'deki auto-updater fix'i yeterli değildi — `tauri-action` post-upload'da `.sig` ve `.nsis.zip` dosyalarını build dizininden temizliyordu, bizim manuel upload step'imiz ulaşamıyordu.

Bu sürümde:
- CI `tauri-action` yerine doğrudan `npx tauri build` çağırıyor (artifact temizleme yok)
- Bundle dizinindeki tüm `.sig`, `.nsis.zip`, `.dmg`, `.exe`, `.msi` dosyaları `gh release upload` ile manuel yükleniyor
- `manifest` job'u `.sig` içeriğini okuyup doğru `latest.json`'ı yazıyor
- Release önce draft olarak açılıyor, manifest job bitince undraft ediliyor

Auto-updater artık v0.8.2 sürümünden itibaren gerçekten çalışıyor.

## [0.8.1] — 2026-04-21

Auto-updater için gerekli `latest.json` manifest'i ve `.sig` imza dosyaları release'e yüklenmiyordu (`tauri-action@v0` "Signature not found" uyarısıyla skip ediyordu). Release workflow'una manuel upload step'leri ve ayrı bir `manifest` job'u eklendi.

- macOS `.app.tar.gz` + `.sig` artık release'e yükleniyor
- Windows `.nsis.zip` + `.sig` artık release'e yükleniyor
- `latest.json` manifest'i cross-platform olarak toplanıp release'e yükleniyor

v0.8.0 kullanıcıları bir defa elle v0.8.1'i indirip kurmalı. Sonraki sürümler auto-updater üzerinden otomatik gelecek.

## [0.8.0] — 2026-04-21

pb-panel artık sadece "durum göster" değil, git workflow'unu panelden yürütmeye izin veren bir kokpit.

### Yeni — Auto-updater
- **Otomatik güncelleme kontrolü** — panel açılışta ve her 6 saatte bir yeni sürüm var mı diye GitHub releases'i kontrol ediyor.
- **Güvenli imza doğrulaması** — her release minisign ile imzalanıyor; panel imzasız paketi reddediyor.
- **İndir + yükle + yeniden başlat** akışı tek butondan yürüyor, ilerleme çubuğu gösteriliyor.
- **Sonra de** diyebilirsin, modal kapanır ve bir sonraki periyodik kontrolde tekrar çıkar.

### Yeni — Branch yönetimi
Repo drawer'ında `Branches` sekmesi eklendi:
- Yerel + remote branch listesi (ahead/behind rozetleri, upstream hedefi, son commit mesajı)
- **Checkout** — dirty working tree varsa engelleyip uyarı verir
- **Yeni branch oluştur** — `HEAD`'den create + checkout tek adımda
- **Push** — upstream yoksa `push -u origin <branch>` otomatik
- **Sil** — confirm dialog'suz silmez; `-d` güvenli, yetmezse `-D` teklifi
- **Remote branch checkout** — `origin/feature/x` klikle yerel `feature/x` olarak otomatik tracked branch oluşturur
- **Stash listesi + save / pop / drop** — stash yönetimi artık aynı yerde

### Yeni — Pull Request yönetimi
`PR` sekmesi artık GitHub API ile okuma/yazma yapıyor:
- Açık PR listesi — title, author, draft durumu, son güncelleme zamanı
- PR detay genişletme — head/base, mergeable durumu, auto-merge aktif mi
- **Yeni PR oluştur** — head/base/title/body/draft seçenekleriyle panel içinden
- **Merge şimdi** — squash / merge / rebase seçilebilir, confirm dialog'lu
- **Auto-merge aç/kapa** — GitHub'ın native auto-merge özelliği GraphQL API üzerinden
- GitHub'da aç linki — tarayıcıda detaylı görüntü için

### Yeni — Çakışma (conflict) çözümü
`Çakışmalar` sekmesi:
- Aktif merge / rebase durumunu tespit eder
- Çakışan dosyaları listeler (git status code'u ile birlikte: UU, AA, vs.)
- Dosya bazlı **diff preview** (monospaced, okunabilir)
- Tek tıkla **ours** ya da **theirs** seçimi — sonra otomatik `git add`
- **IDE'de aç** — detaylı merge resolution için IDE'yi direkt çağırır
- Tüm dosyalar çözülünce **Devam** butonu (`merge --continue` / `rebase --continue`)
- **İptal** — `merge/rebase --abort`, confirm dialog'lu

### Yeni — Native bildirimler
Her durum değişikliğinde sistem bildirimi:
- "Yeni commit var" — remote'ta yeni commit belirdiğinde
- "Uncommitted değişiklik" — temiz bir repo kirlendiğinde (bilgisayarı kapatmadan önce hatırlatıcı)
- "Remote güncellendi" — fetch edilmemiş yeni iş belirdiğinde
- Bildirim izni ilk repo taramasında bir kez sorulur, sonra sessizce işler

### Geliştirmeler
- RepoDrawer artık 4 sekmeli: Genel bakış · Branches · PR · Çakışmalar
- Çakışma varsa sekme başlığında kırmızı rozet görünür
- Lokal durum özet tablosu (ahead/behind/dirty/remote updates) Genel bakış sekmesine eklendi
- Tüm API çağrıları artık `tauri::invoke` üzerinden; hiçbir durum frontend'de stale kalmayacak şekilde her actions'dan sonra drawer parent'e `onRefresh` tetikleniyor

### Teknik
- Yeni Rust modülleri: `branches.rs` (230 satır), `conflicts.rs` (180 satır), `prs.rs` (260 satır)
- Yeni Tauri plugin'leri: `tauri-plugin-updater`, `tauri-plugin-process`
- 22 yeni `#[tauri::command]`
- 3 yeni React componenti: `BranchesPanel`, `PullRequestsPanel`, `ConflictsPanel`
- Tüm değişiklikler git / cargo-check / tsc-noEmit / vite-build'dan temiz geçiyor

---

## [0.2.0] — 2026-04-20

İlk public release. Ayrıntı için [GitHub releases](https://github.com/By-Taika/pb-panel/releases/tag/v0.2.0).

Öne çıkanlar:
- Tauri v2 üzerinde macOS + Windows native app
- Dinamik config (ilk açılışta sihirbaz) — base dizini, hesaplar, kategoriler kullanıcı tarafından tanımlanıyor
- Keychain-backed token saklama
- Tray icon + her 60 saniyede arka plan tarama
- Repo drawer — GitHub meta + PR'lar + commit geçmişi
- Bulk pull "behind olanları çek"

---

## [Unreleased]

Bu bölümde bir sonraki sürüme planlanan değişiklikler listelenir.

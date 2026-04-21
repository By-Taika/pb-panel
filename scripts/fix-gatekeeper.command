#!/bin/bash
# pb-panel için macOS Gatekeeper uyarısını tek seferde temizler.
# Ad-hoc imzalı Tauri uygulamaları App Store dışından geldiği için
# Apple Gatekeeper karantine koyuyor — bu script onu siler.
#
# Kullanım: dosyaya çift tıkla, Terminal otomatik açılır, komut çalışır.

APP="/Applications/pb-panel.app"

echo "────────────────────────────────────────"
echo "  pb-panel — Gatekeeper fix"
echo "────────────────────────────────────────"
echo

if [ ! -d "$APP" ]; then
  echo "❌ $APP bulunamadı."
  echo "   Önce pb-panel.app'i Applications klasörüne sürükle."
  echo
  read -n 1 -s -r -p "Kapatmak için bir tuşa bas..."
  exit 1
fi

echo "• Mevcut karantine özniteliği:"
xattr "$APP" 2>/dev/null | sed 's/^/    /'

echo
echo "• Karantine ve ilgili öznitelikler siliniyor…"
xattr -cr "$APP"

if [ $? -eq 0 ]; then
  echo
  echo "✓ Tamam. Artık pb-panel'i Launchpad'den veya Applications'tan"
  echo "  çift tıklayarak sorunsuz açabilirsin."
else
  echo
  echo "⚠ Silme başarısız. Sudo ile tekrar dene:"
  echo "    sudo xattr -cr /Applications/pb-panel.app"
fi

echo
read -n 1 -s -r -p "Kapatmak için bir tuşa bas..."

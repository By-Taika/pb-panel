import { useEffect, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import { installUpdate } from '../lib/updater';

interface Props {
  update: Update;
  onDismiss: () => void;
}

export function UpdateModal({ update, onDismiss }: Props) {
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setPhase('downloading');
    setProgress(0);
    try {
      await installUpdate(update, (downloaded, total) => {
        if (total && total > 0) {
          setProgress(Math.round((downloaded / total) * 100));
        } else {
          setProgress((p) => Math.min(99, p + 1));
        }
      });
      setPhase('installing');
    } catch (e: any) {
      setError(e?.message || String(e));
      setPhase('error');
    }
  };

  useEffect(() => {
    // Prevent background click from closing during download.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'idle') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="relative w-full max-w-lg bg-panel-bg border border-panel-border rounded-lg shadow-2xl p-6">
        <header className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-panel-accent to-panel-accent2 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">↑</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-panel-text">Yeni sürüm var</h2>
            <div className="text-xs text-panel-muted mt-0.5">
              {update.currentVersion} → <span className="text-panel-accent font-mono">{update.version}</span>
              {update.date && ` · ${new Date(update.date).toLocaleDateString('tr-TR')}`}
            </div>
          </div>
        </header>

        {update.body && (
          <div className="max-h-48 overflow-y-auto mb-4 p-3 bg-panel-raised rounded text-xs text-panel-muted whitespace-pre-wrap">
            {update.body}
          </div>
        )}

        {phase === 'idle' && (
          <>
            <p className="text-xs text-panel-muted mb-4">
              Güncelleme indirildikten sonra panel yeniden başlayacak. Açık işlerin kaybolmaz ama yeniden açmak gerekebilir.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={onDismiss} className="btn-ghost">
                Sonra
              </button>
              <button onClick={go} className="btn-primary">
                İndir ve yükle
              </button>
            </div>
          </>
        )}

        {phase === 'downloading' && (
          <div>
            <div className="flex items-center justify-between text-xs text-panel-muted mb-1">
              <span>İndiriliyor…</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-panel-raised rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-panel-accent to-panel-accent2 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'installing' && (
          <div className="text-xs text-panel-muted">Yükleniyor, birazdan yeniden başlatılacak…</div>
        )}

        {phase === 'error' && (
          <div>
            <div className="text-xs text-panel-danger mb-3">Güncelleme hatası: {error}</div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={onDismiss} className="btn-ghost">Kapat</button>
              <button onClick={() => setPhase('idle')} className="btn-primary">Tekrar dene</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

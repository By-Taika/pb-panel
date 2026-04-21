import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ConflictState, RepoInfo } from '../lib/types';

interface Props {
  repo: RepoInfo;
  onToast: (msg: string, ok: boolean) => void;
  onChanged: () => void;
}

export function ConflictsPanel({ repo, onToast, onChanged }: Props) {
  const [state, setState] = useState<ConflictState | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => {
    api.conflicts(repo.category, repo.name, repo.subCategory).then(setState);
  };

  useEffect(() => {
    reload();
  }, [repo.id]);

  useEffect(() => {
    if (!openFile) {
      setDiff('');
      return;
    }
    setDiff('yükleniyor…');
    api.conflictDiff(repo.category, repo.name, repo.subCategory, openFile).then(setDiff).catch((e) => setDiff(String(e)));
  }, [openFile, repo.id]);

  const wrap = async <T,>(key: string, fn: () => Promise<T>, okMsg: string) => {
    setBusy(key);
    try {
      const res: any = await fn();
      const ok = res?.ok !== false;
      onToast(ok ? okMsg : res?.output || 'hata', ok);
      reload();
      onChanged();
      if (ok) setOpenFile(null);
    } catch (e: any) {
      onToast(e?.message || String(e), false);
    } finally {
      setBusy(null);
    }
  };

  if (!state) {
    return <div className="text-xs text-panel-muted">Yükleniyor…</div>;
  }

  const inProgress = state.inMerge || state.inRebase;
  const label = state.inRebase ? 'rebase' : state.inMerge ? 'merge' : null;

  if (!inProgress && state.files.length === 0) {
    return (
      <div className="text-xs text-panel-muted border border-dashed border-panel-border rounded p-4 text-center">
        Çakışma yok. Bu repo temiz bir durumda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex items-center justify-between gap-2 p-3 rounded border border-panel-danger/40 bg-panel-danger/10">
          <div className="text-xs">
            <div className="font-bold text-panel-danger">{label.toUpperCase()} devam ediyor</div>
            <div className="text-[10px] text-panel-muted mt-0.5">
              {state.files.length} dosyada çakışma var. Her birini çöz (ours/theirs/manuel), sonra devam et ya da iptal et.
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              className="btn-primary !py-0.5 !text-[10px]"
              disabled={busy !== null || state.files.length > 0}
              onClick={() =>
                wrap('cont', () => api.conflictContinue(repo.category, repo.name, repo.subCategory), `${label} tamamlandı`)
              }
              title={state.files.length > 0 ? 'Önce tüm dosyaları çöz' : `${label} devam`}
            >
              ✓ Devam
            </button>
            <button
              className="btn-ghost !py-0.5 !text-[10px] text-panel-danger"
              disabled={busy !== null}
              onClick={() => {
                if (!confirm(`${label} iptal edilsin mi? Değişiklikler geri alınacak.`)) return;
                wrap('abort', () => api.conflictAbort(repo.category, repo.name, repo.subCategory), `${label} iptal edildi`);
              }}
            >
              × İptal
            </button>
          </div>
        </div>
      )}

      {state.files.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-panel-muted mb-2">
            Çakışan dosyalar ({state.files.length})
          </h3>
          <ul className="space-y-1">
            {state.files.map((f) => (
              <li
                key={f.path}
                className={`rounded border text-xs ${
                  openFile === f.path
                    ? 'border-panel-accent bg-panel-raised'
                    : 'border-panel-border hover:border-panel-accent/50'
                }`}
              >
                <button
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-left"
                  onClick={() => setOpenFile(openFile === f.path ? null : f.path)}
                >
                  <span className="font-mono text-panel-text truncate min-w-0 flex-1">{f.path}</span>
                  <span className="chip border-panel-border text-panel-muted !text-[9px] ml-2">{f.statusCode}</span>
                </button>

                {openFile === f.path && (
                  <div className="border-t border-panel-border p-2 space-y-2">
                    <pre className="text-[10px] font-mono bg-black/40 rounded p-2 overflow-x-auto max-h-64 whitespace-pre">
                      {diff}
                    </pre>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        className="btn-ghost !py-0.5 !text-[10px]"
                        disabled={busy !== null}
                        onClick={() =>
                          wrap(
                            `ours-${f.path}`,
                            () => api.conflictResolveOurs(repo.category, repo.name, repo.subCategory, f.path),
                            `${f.path} → ours`,
                          )
                        }
                      >
                        ← ours seç
                      </button>
                      <button
                        className="btn-ghost !py-0.5 !text-[10px]"
                        disabled={busy !== null}
                        onClick={() =>
                          wrap(
                            `theirs-${f.path}`,
                            () => api.conflictResolveTheirs(repo.category, repo.name, repo.subCategory, f.path),
                            `${f.path} → theirs`,
                          )
                        }
                      >
                        theirs seç →
                      </button>
                      <button
                        className="btn-ghost !py-0.5 !text-[10px]"
                        onClick={() =>
                          api.openIde(repo.category, repo.name, repo.subCategory).then((r) => {
                            onToast(r.ok ? 'IDE açıldı' : r.output, r.ok);
                          })
                        }
                      >
                        IDE'de aç
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

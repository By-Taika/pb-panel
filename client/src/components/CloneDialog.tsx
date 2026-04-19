import { useMemo, useState } from 'react';
import type { AccountConfig, Category, CategoryConfig, RepoInfo } from '../lib/types';
import { api } from '../lib/api';

interface CloneDialogProps {
  categories: CategoryConfig[];
  accounts: AccountConfig[];
  repos: Record<Category, RepoInfo[]>;
  onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}

export function CloneDialog({ categories, accounts, repos, onClose, onDone }: CloneDialogProps) {
  const [category, setCategory] = useState<Category>(() => categories[0]?.name ?? '');
  const [subCategory, setSubCategory] = useState('');
  const [ownerRepo, setOwnerRepo] = useState('');
  const [targetName, setTargetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentCat = categories.find((c) => c.name === category);
  const currentAccount = accounts.find((a) => a.id === currentCat?.accountId) ?? null;

  const existingSubs = useMemo(() => {
    const set = new Set<string>();
    (repos[category] || []).forEach((r) => {
      if (r.subCategory) set.add(r.subCategory);
    });
    return Array.from(set).sort();
  }, [category, repos]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerRepo.trim() || !category) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.clone(
        category,
        ownerRepo.trim(),
        targetName.trim() || undefined,
        subCategory.trim() || undefined,
      );
      if (!res.ok) {
        setError(res.output);
        return;
      }
      onDone(`Cloned → ${res.path}`, true);
      onClose();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (categories.length === 0) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-panel-surface border border-panel-border rounded-lg p-6 space-y-3">
          <h2 className="font-mono text-sm font-bold">Repo Clone</h2>
          <p className="text-sm text-panel-muted">
            Henüz kategori yok. Ayarlar'dan kategori ekledikten sonra clone yapabilirsin.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn-ghost">
              Kapat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-panel-surface border border-panel-border rounded-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold">Repo Clone</h2>
          <button type="button" onClick={onClose} className="text-panel-muted hover:text-panel-text text-lg">
            ×
          </button>
        </div>

        <div>
          <label className="text-xs text-panel-muted block mb-1">Kategori</label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  setCategory(c.name);
                  setSubCategory('');
                }}
                className={`px-2 py-2 text-xs rounded border transition-colors ${
                  category === c.name
                    ? 'bg-panel-raised border-panel-accent text-panel-text'
                    : 'border-panel-border text-panel-muted hover:text-panel-text'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {currentAccount ? (
            <div className="chip mt-2 text-panel-accent border-panel-accent/40">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Hesap: {currentAccount.label}
            </div>
          ) : (
            <div className="chip mt-2 text-panel-danger border-panel-danger/40">
              Bu kategoride hesap atanmamış
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-panel-muted block mb-1">
            Alt kategori <span className="opacity-60">(opsiyonel, ör. "Mobil Uygulama")</span>
          </label>
          <input
            type="text"
            list="pb-existing-subs"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            placeholder={existingSubs.length ? `Mevcut: ${existingSubs.join(', ')}` : 'Boş bırakırsan kategoriye doğrudan girer'}
            className="w-full px-3 py-2 text-sm bg-panel-bg border border-panel-border rounded focus:border-panel-accent outline-none"
          />
          <datalist id="pb-existing-subs">
            {existingSubs.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="text-xs text-panel-muted block mb-1">Repo (owner/name, URL, veya git@…)</label>
          <input
            autoFocus
            type="text"
            value={ownerRepo}
            onChange={(e) => setOwnerRepo(e.target.value)}
            placeholder="By-Taika/cool-project"
            className="w-full px-3 py-2 text-sm bg-panel-bg border border-panel-border rounded focus:border-panel-accent outline-none font-mono"
          />
        </div>

        <div>
          <label className="text-xs text-panel-muted block mb-1">Klasör adı (opsiyonel)</label>
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            placeholder="(repo adını kullan)"
            className="w-full px-3 py-2 text-sm bg-panel-bg border border-panel-border rounded focus:border-panel-accent outline-none font-mono"
          />
        </div>

        {error && (
          <div className="text-xs text-panel-danger bg-panel-danger/10 border border-panel-danger/30 rounded p-2 whitespace-pre-wrap font-mono">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            İptal
          </button>
          <button type="submit" disabled={busy || !ownerRepo.trim()} className="btn-primary">
            {busy && <span className="spinner" />} {busy ? 'Cloning…' : 'Clone'}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RepoCard } from './components/RepoCard';
import { CloneDialog } from './components/CloneDialog';
import { ToastStack } from './components/Toast';
import { api } from './lib/api';
import type { AccountsInfo, Category, RepoInfo } from './lib/types';
import { CATEGORIES } from './lib/types';

export function App() {
  const [accounts, setAccounts] = useState<AccountsInfo | null>(null);
  const [repos, setRepos] = useState<Record<Category, RepoInfo[]>>({} as any);
  const [selected, setSelected] = useState<Category | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([]);

  const toast = useCallback((msg: string, ok: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const loadRepos = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.repos();
      setRepos(data);
    } catch (e: any) {
      toast(`Load error: ${e.message}`, false);
    } finally {
      setRefreshing(false);
    }
  }, [toast]);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await api.accounts());
    } catch {
      // ok
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadRepos();
  }, [loadAccounts, loadRepos]);

  // Background auto-refresh: re-scan every 30s, but only while the tab is visible
  // so we don't burn cycles when the panel is minimized/backgrounded.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') loadRepos();
    };
    const id = window.setInterval(tick, 30_000);
    const onVis = () => { if (document.visibilityState === 'visible') loadRepos(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadRepos]);

  const visibleCategories = selected === 'all' ? CATEGORIES : [selected];
  const totalRepos = Object.values(repos).reduce((s, list) => s + list.length, 0);

  const pullAllDirty = async () => {
    const toPull = Object.values(repos)
      .flat()
      .filter((r) => r.behind > 0 && r.dirty === 0);
    if (toPull.length === 0) {
      toast('Çekilecek repo yok (behind=0 veya dirty)', true);
      return;
    }
    toast(`${toPull.length} repo güncelleniyor…`, true);
    await Promise.all(
      toPull.map((r) =>
        api.pull(r.category, r.name, r.subCategory).then((res) => toast(`${r.name}: ${res.ok ? '✓' : '✗'}`, res.ok))
      )
    );
    loadRepos();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        accounts={accounts}
        totalRepos={totalRepos}
        onRefresh={loadRepos}
        onClone={() => setShowClone(true)}
        refreshing={refreshing}
      />

      <div className="flex-1 flex">
        <Sidebar repos={repos} selected={selected} onSelect={setSelected} />

        <main className="flex-1 p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-panel-muted">
              {selected === 'all' ? 'Tüm kategoriler' : selected}
            </div>
            <button onClick={pullAllDirty} className="btn-ghost">
              ↓↓ Pull behind'i olanları
            </button>
          </div>

          {visibleCategories.map((cat) => {
            const list = repos[cat] || [];
            const grouped = groupBySub(list);

            return (
              <section key={cat} className="mb-8">
                {selected === 'all' && (
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="font-mono text-xs uppercase tracking-widest text-panel-muted">{cat}</h2>
                    <span className="text-[10px] text-panel-muted">({list.length})</span>
                    <div className="flex-1 h-px bg-panel-border ml-2" />
                  </div>
                )}

                {list.length === 0 ? (
                  <EmptyState category={cat} onClone={() => setShowClone(true)} />
                ) : (
                  <div className="space-y-5">
                    {grouped.map(([sub, items]) => (
                      <div key={sub ?? '__none'}>
                        {sub !== null && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-mono text-panel-text">▸ {sub}</span>
                            <span className="text-[10px] text-panel-muted">({items.length})</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                          {items.map((r) => (
                            <RepoCard key={r.id} repo={r} onAction={toast} onRefresh={loadRepos} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </main>
      </div>

      {showClone && (
        <CloneDialog
          repos={repos}
          onClose={() => setShowClone(false)}
          onDone={(m, ok) => {
            toast(m, ok);
            loadRepos();
          }}
        />
      )}
      <ToastStack items={toasts} />
    </div>
  );
}

function groupBySub(list: RepoInfo[]): Array<[string | null, RepoInfo[]]> {
  const map = new Map<string | null, RepoInfo[]>();
  for (const r of list) {
    const key = r.subCategory;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  // Flat (null) first, then alphabetical sub-categories
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === null) return -1;
    if (b[0] === null) return 1;
    return a[0]!.localeCompare(b[0]!);
  });
}

function EmptyState({ category, onClone }: { category: Category; onClone: () => void }) {
  return (
    <div className="border border-dashed border-panel-border rounded-lg p-8 text-center text-panel-muted">
      <div className="text-sm mb-2">{category} kategorisinde henüz repo yok</div>
      <button onClick={onClone} className="btn-primary">
        + Clone
      </button>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Update } from '@tauri-apps/plugin-updater';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RepoCard } from './components/RepoCard';
import { CloneDialog } from './components/CloneDialog';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastStack } from './components/Toast';
import { UpdateModal } from './components/UpdateModal';
import { api } from './lib/api';
import { diffAndNotify, ensureNotificationPermission } from './lib/notifications';
import { checkForUpdate } from './lib/updater';
import { useT } from './lib/i18n';
import type { AccountsInfo, Category, Config, RepoInfo } from './lib/types';

type Toast = { id: number; msg: string; ok: boolean };

export function App() {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [accounts, setAccounts] = useState<AccountsInfo | null>(null);
  const [repos, setRepos] = useState<Record<Category, RepoInfo[]>>({});
  const [selected, setSelected] = useState<Category | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2>(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const previousRepos = useRef<Record<Category, RepoInfo[]> | null>(null);

  const toast = useCallback((msg: string, ok: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const loadConfig = useCallback(async () => {
    const cfg = await api.getConfig();
    setConfig(cfg);
    return cfg;
  }, []);

  const loadRepos = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.repos();
      // Diff against the last snapshot so the user gets a native notification
      // for meaningful state changes (new behind commits, new dirty files).
      diffAndNotify(previousRepos.current, data, t);
      previousRepos.current = data;
      setRepos(data);
    } catch (e: any) {
      toast(`Load error: ${e.message}`, false);
    } finally {
      setRefreshing(false);
    }
  }, [toast, t]);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await api.accounts());
    } catch {
      // ignore — token missing is the usual cause
    }
  }, []);

  // Initial boot — load config; data loads only after config is ready.
  useEffect(() => {
    loadConfig().catch((e) => toast(`Config load: ${e.message || e}`, false));
  }, [loadConfig, toast]);

  // Whenever config arrives (fresh or after save), trigger a re-scan + account refresh
  useEffect(() => {
    if (!config) return;
    if (!config.firstRunComplete) return;
    loadAccounts();
    loadRepos();
  }, [config?.firstRunComplete, config?.baseDir, config?.categories.length, config?.accounts.length, loadAccounts, loadRepos]);

  // 30s auto-refresh while visible
  useEffect(() => {
    if (!config?.firstRunComplete) return;
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
  }, [config?.firstRunComplete, loadRepos]);

  // Tray menu events
  useEffect(() => {
    const offs: Array<Promise<() => void>> = [
      listen('pb-panel://refresh', () => loadRepos()),
      listen('pb-panel://open-settings', () => setShowSettings(true)),
    ];
    return () => {
      offs.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, [loadRepos]);

  // Ask for notification permission once first-run is complete.
  useEffect(() => {
    if (!config?.firstRunComplete) return;
    ensureNotificationPermission();
  }, [config?.firstRunComplete]);

  // Check for app updates on startup, then every 15 minutes. Also listens for
  // an explicit trigger from the tray menu so you can force a check without
  // waiting.
  useEffect(() => {
    if (!config?.firstRunComplete) return;
    let cancelled = false;
    const runCheck = async (manual = false) => {
      const res = await checkForUpdate();
      if (cancelled) return;
      if (res.kind === 'available') {
        setPendingUpdate(res.update);
        setUpdateDismissed(false); // bring the modal back even if previously dismissed
      } else if (res.kind === 'none' && manual) {
        toast('Güncelleme yok, en güncel sürüm kurulu.', true);
      } else if (res.kind === 'error' && manual) {
        toast(`Güncelleme kontrolü hatası: ${res.message}`, false);
      }
    };
    // Initial check, then every minute thereafter. Checking latest.json is a
    // cheap CDN fetch (releases asset redirect), not a GitHub API call, so
    // rate limits don't apply — we can poll aggressively.
    if (!updateDismissed) runCheck(false);
    const id = window.setInterval(() => runCheck(false), 60 * 1000);
    // Tray → "Check for updates" manual trigger.
    const unlisten = listen('pb-panel://check-updates', () => runCheck(true));
    return () => {
      cancelled = true;
      window.clearInterval(id);
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [config?.firstRunComplete, updateDismissed, toast]);

  // --- Gating states ---
  if (!config) {
    return <BootSplash label={t('main.booting')} />;
  }

  if (!config.firstRunComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SettingsPanel
          mode="onboarding"
          initial={config}
          onboardingStep={onboardingStep}
          onOnboardingStepChange={setOnboardingStep}
          onClose={() => { /* not cancellable during onboarding */ }}
          onSaved={(cfg) => {
            setConfig(cfg);
          }}
          onToast={toast}
        />
        <ToastStack items={toasts} />
      </div>
    );
  }

  const visibleCategoryNames = selected === 'all'
    ? config.categories.map((c) => c.name)
    : [selected];
  const totalRepos = Object.values(repos).reduce((s, list) => s + list.length, 0);

  const pullAllDirty = async () => {
    const toPull = Object.values(repos)
      .flat()
      .filter((r) => r.behind > 0 && r.dirty === 0);
    if (toPull.length === 0) {
      toast(t('main.noRepoToPull'), true);
      return;
    }
    toast(t('main.pullingN', { n: toPull.length }), true);
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
        configuredAccounts={config.accounts}
        accounts={accounts}
        totalRepos={totalRepos}
        onRefresh={loadRepos}
        onClone={() => setShowClone(true)}
        onSettings={() => setShowSettings(true)}
        refreshing={refreshing}
      />

      <div className="flex-1 flex">
        <Sidebar
          categories={config.categories}
          repos={repos}
          selected={selected}
          onSelect={setSelected}
        />

        <main className="flex-1 p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-panel-muted">
              {selected === 'all' ? t('main.allCategories') : selected}
            </div>
            <button onClick={pullAllDirty} className="btn-ghost">
              {t('main.pullAllBehind')}
            </button>
          </div>

          {visibleCategoryNames.length === 0 && (
            <div className="border border-dashed border-panel-border rounded-lg p-10 text-center">
              <div className="text-sm text-panel-muted mb-3">{t('main.noCategories')}</div>
              <button onClick={() => setShowSettings(true)} className="btn-primary">
                ⚙ {t('header.settings')}
              </button>
            </div>
          )}

          {visibleCategoryNames.map((catName) => {
            const list = repos[catName] || [];
            const grouped = groupBySub(list);

            return (
              <section key={catName} className="mb-8">
                {selected === 'all' && (
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="font-mono text-xs uppercase tracking-widest text-panel-muted">{catName}</h2>
                    <span className="text-[10px] text-panel-muted">({list.length})</span>
                    <div className="flex-1 h-px bg-panel-border ml-2" />
                  </div>
                )}

                {list.length === 0 ? (
                  <EmptyState category={catName} onClone={() => setShowClone(true)} />
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
          categories={config.categories}
          accounts={config.accounts}
          repos={repos}
          onClose={() => setShowClone(false)}
          onDone={(m, ok) => {
            toast(m, ok);
            loadRepos();
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          initial={config}
          onClose={() => setShowSettings(false)}
          onSaved={(cfg) => {
            setConfig(cfg);
            setShowSettings(false);
          }}
          onToast={toast}
        />
      )}

      {pendingUpdate && (
        <UpdateModal
          update={pendingUpdate}
          onDismiss={() => {
            setPendingUpdate(null);
            setUpdateDismissed(true);
          }}
        />
      )}

      <ToastStack items={toasts} />
    </div>
  );
}

function BootSplash({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-panel-accent to-panel-accent2 animate-pulse" />
      <div className="text-xs text-panel-muted font-mono">{label}</div>
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
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === null) return -1;
    if (b[0] === null) return 1;
    return a[0]!.localeCompare(b[0]!);
  });
}

function EmptyState({ category, onClone }: { category: Category; onClone: () => void }) {
  const t = useT();
  return (
    <div className="border border-dashed border-panel-border rounded-lg p-8 text-center text-panel-muted">
      <div className="text-sm mb-2">{t('main.emptyCategory', { cat: category })}</div>
      <button onClick={onClone} className="btn-primary">
        + {t('header.clone')}
      </button>
    </div>
  );
}

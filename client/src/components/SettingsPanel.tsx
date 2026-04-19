import { useEffect, useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { api } from '../lib/api';
import type { AccountConfig, CategoryConfig, Config } from '../lib/types';

interface Props {
  initial: Config;
  onClose: () => void;
  onSaved: (cfg: Config) => void;
  onToast: (msg: string, ok: boolean) => void;
  /** When shown as onboarding, hides Cancel and forces the user to save. */
  mode?: 'settings' | 'onboarding';
  onboardingStep?: 0 | 1 | 2;
  onOnboardingStepChange?: (step: 0 | 1 | 2) => void;
}

type Tab = 'general' | 'accounts' | 'categories';

export function SettingsPanel({
  initial,
  onClose,
  onSaved,
  onToast,
  mode = 'settings',
  onboardingStep = 0,
  onOnboardingStepChange,
}: Props) {
  const [cfg, setCfg] = useState<Config>(() => structuredClone(initial));
  const [tab, setTab] = useState<Tab>(() =>
    mode === 'onboarding' ? tabForStep(onboardingStep) : 'general',
  );
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});
  const [tokensKnown, setTokensKnown] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Load "does this account have a keychain token?" once per accounts list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        cfg.accounts.map(async (a) => [a.id, await api.accountHasToken(a.id)] as const),
      );
      if (cancelled) return;
      setTokensKnown(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.accounts.map((a) => a.id).join('|')]);

  useEffect(() => {
    if (mode === 'onboarding') setTab(tabForStep(onboardingStep));
  }, [mode, onboardingStep]);

  const saveDisabled = useMemo(() => {
    if (saving) return true;
    if (!cfg.baseDir.trim()) return true;
    return false;
  }, [saving, cfg.baseDir]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist any pending token inputs first (keychain).
      for (const [id, val] of Object.entries(tokenDrafts)) {
        const trimmed = val.trim();
        if (!trimmed) continue;
        try {
          await api.setAccountToken(id, trimmed);
        } catch (e: any) {
          onToast(`Token kaydı başarısız (${id}): ${e.message || e}`, false);
          setSaving(false);
          return;
        }
      }
      const next: Config = {
        ...cfg,
        firstRunComplete: true,
      };
      await api.saveConfig(next);
      onToast('Ayarlar kaydedildi', true);
      setTokenDrafts({});
      onSaved(next);
    } catch (e: any) {
      onToast(`Kaydetme hatası: ${e.message || e}`, false);
    } finally {
      setSaving(false);
    }
  };

  const pickBaseDir = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Base klasörü seç',
      defaultPath: cfg.baseDir || undefined,
    });
    if (typeof selected === 'string' && selected) {
      setCfg((c) => ({ ...c, baseDir: selected }));
    }
  };

  const autofillCategories = async () => {
    if (!cfg.baseDir.trim()) {
      onToast('Önce base klasörü seç', false);
      return;
    }
    const subs = await api.listSubfolders(cfg.baseDir);
    const existing = new Set(cfg.categories.map((c) => c.name));
    const toAdd = subs
      .filter((s) => !existing.has(s))
      .map<CategoryConfig>((name) => ({
        name,
        accountId: cfg.accounts[0]?.id ?? '',
        nested: true,
        hide: [],
      }));
    if (toAdd.length === 0) {
      onToast('Yeni kategori bulunamadı', true);
      return;
    }
    setCfg((c) => ({ ...c, categories: [...c.categories, ...toAdd] }));
    onToast(`${toAdd.length} kategori eklendi`, true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="bg-panel-bg border border-panel-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-panel-border">
          <div>
            <h2 className="font-mono text-sm font-bold text-panel-text">
              {mode === 'onboarding' ? 'pb-panel kurulumu' : 'Ayarlar'}
            </h2>
            <p className="text-[11px] text-panel-muted mt-0.5">
              {mode === 'onboarding'
                ? 'Hızlıca temel ayarları yapalım'
                : 'Base klasör, GitHub hesapları ve kategoriler'}
            </p>
          </div>
          {mode === 'settings' && (
            <button onClick={onClose} className="btn-ghost !py-1 !px-2" title="Kapat (Esc)">
              ✕
            </button>
          )}
        </header>

        <div className="flex flex-1 min-h-0">
          <nav className="w-44 shrink-0 border-r border-panel-border p-3 space-y-1 text-sm">
            <TabItem active={tab === 'general'} onClick={() => setTab('general')} label="Genel" step={1} />
            <TabItem active={tab === 'accounts'} onClick={() => setTab('accounts')} label="Hesaplar" step={2} />
            <TabItem active={tab === 'categories'} onClick={() => setTab('categories')} label="Kategoriler" step={3} />
          </nav>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
            {tab === 'general' && (
              <GeneralTab cfg={cfg} setCfg={setCfg} pickBaseDir={pickBaseDir} />
            )}

            {tab === 'accounts' && (
              <AccountsTab
                cfg={cfg}
                setCfg={setCfg}
                tokenDrafts={tokenDrafts}
                setTokenDrafts={setTokenDrafts}
                tokensKnown={tokensKnown}
                onDeleteToken={async (id) => {
                  try {
                    await api.deleteAccountToken(id);
                    setTokensKnown((p) => ({ ...p, [id]: false }));
                    onToast(`Token silindi (${id})`, true);
                  } catch (e: any) {
                    onToast(`Silme hatası: ${e.message || e}`, false);
                  }
                }}
              />
            )}

            {tab === 'categories' && (
              <CategoriesTab cfg={cfg} setCfg={setCfg} onAutofill={autofillCategories} />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-3 border-t border-panel-border">
          <div className="text-[11px] text-panel-muted font-mono">
            {cfg.accounts.length} hesap · {cfg.categories.length} kategori
          </div>
          <div className="flex items-center gap-2">
            {mode === 'onboarding' ? (
              <>
                <button
                  className="btn-ghost"
                  disabled={onboardingStep === 0}
                  onClick={() => onOnboardingStepChange?.((onboardingStep - 1) as 0 | 1 | 2)}
                >
                  Geri
                </button>
                {onboardingStep < 2 ? (
                  <button
                    className="btn-primary"
                    onClick={() => onOnboardingStepChange?.((onboardingStep + 1) as 0 | 1 | 2)}
                  >
                    İleri
                  </button>
                ) : (
                  <button className="btn-primary" onClick={handleSave} disabled={saveDisabled}>
                    {saving ? 'Kaydediliyor…' : 'Bitir'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn-ghost" onClick={onClose}>
                  Vazgeç
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saveDisabled}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function tabForStep(step: 0 | 1 | 2): Tab {
  return step === 0 ? 'general' : step === 1 ? 'accounts' : 'categories';
}

function TabItem({
  active,
  onClick,
  label,
  step,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  step: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left ${
        active
          ? 'bg-panel-raised text-panel-text border-l-2 border-l-panel-accent'
          : 'text-panel-muted hover:bg-panel-raised/50 border-l-2 border-l-transparent'
      }`}
    >
      <span className="text-[10px] font-mono opacity-70">{step}.</span>
      <span>{label}</span>
    </button>
  );
}

// --- General tab --------------------------------------------------------

function GeneralTab({
  cfg,
  setCfg,
  pickBaseDir,
}: {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  pickBaseDir: () => void;
}) {
  return (
    <section className="space-y-5 max-w-2xl">
      <Field
        label="Base klasör"
        hint="Tüm kategoriler bu klasörün altında aranır. Ör: ~/ProjectBase"
      >
        <div className="flex gap-2">
          <input
            value={cfg.baseDir}
            onChange={(e) => setCfg((c) => ({ ...c, baseDir: e.target.value }))}
            placeholder="/Users/isim/ProjectBase"
            className="input flex-1 font-mono text-xs"
          />
          <button className="btn-ghost" onClick={pickBaseDir}>
            Klasör seç…
          </button>
        </div>
      </Field>
      <div className="text-[11px] text-panel-muted">
        Config dosyası: <span className="font-mono">~/Library/Application Support/com.codecrew.pbpanel/config.json</span>
      </div>
    </section>
  );
}

// --- Accounts tab -------------------------------------------------------

function AccountsTab({
  cfg,
  setCfg,
  tokenDrafts,
  setTokenDrafts,
  tokensKnown,
  onDeleteToken,
}: {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  tokenDrafts: Record<string, string>;
  setTokenDrafts: (f: (p: Record<string, string>) => Record<string, string>) => void;
  tokensKnown: Record<string, boolean>;
  onDeleteToken: (id: string) => void;
}) {
  const updateAccount = (id: string, patch: Partial<AccountConfig>) => {
    setCfg((c) => ({
      ...c,
      accounts: c.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };
  const removeAccount = (id: string) => {
    setCfg((c) => {
      // Unassign any category pointing at this account so they don't orphan.
      return {
        ...c,
        accounts: c.accounts.filter((a) => a.id !== id),
        categories: c.categories.map((cat) =>
          cat.accountId === id ? { ...cat, accountId: '' } : cat,
        ),
      };
    });
  };
  const addAccount = () => {
    const id = `account-${Date.now().toString(36)}`;
    setCfg((c) => ({
      ...c,
      accounts: [
        ...c.accounts,
        { id, label: 'Yeni hesap', username: '', envVar: null },
      ],
    }));
  };

  return (
    <section className="space-y-4">
      <p className="text-[11px] text-panel-muted">
        Her GitHub kimliği için bir hesap tanımla. Token'lar macOS Keychain'de saklanır, config dosyasında değil.
      </p>

      {cfg.accounts.length === 0 && (
        <div className="border border-dashed border-panel-border rounded-lg p-5 text-center text-panel-muted text-sm">
          Henüz hesap yok.
        </div>
      )}

      <div className="space-y-3">
        {cfg.accounts.map((a) => {
          const hasToken = tokensKnown[a.id] === true;
          const draft = tokenDrafts[a.id] ?? '';
          return (
            <div key={a.id} className="border border-panel-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="chip border-panel-accent/40 text-panel-accent">{a.id}</span>
                <button
                  onClick={() => removeAccount(a.id)}
                  className="ml-auto btn-ghost !py-1 !px-2 text-[11px] text-panel-danger"
                  title="Hesabı sil"
                >
                  Sil
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Etiket" hint="UI'da gösterilen ad">
                  <input
                    value={a.label}
                    onChange={(e) => updateAccount(a.id, { label: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="GitHub username" hint="Clone URL'leri için">
                  <input
                    value={a.username ?? ''}
                    onChange={(e) => updateAccount(a.id, { username: e.target.value })}
                    placeholder="ör. by-taika"
                    className="input font-mono"
                  />
                </Field>
              </div>

              <Field
                label={hasToken ? 'Token (değiştirmek için yeni değer gir)' : 'Token'}
                hint="Classic PAT ya da fine-grained token. repo scope'lu."
              >
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={draft}
                    onChange={(e) =>
                      setTokenDrafts((p) => ({ ...p, [a.id]: e.target.value }))
                    }
                    placeholder={hasToken ? '●●●●●●●● · Keychain' : 'ghp_… / github_pat_…'}
                    className="input flex-1 font-mono text-xs"
                  />
                  {hasToken && (
                    <button
                      className="btn-ghost text-panel-danger"
                      onClick={() => onDeleteToken(a.id)}
                    >
                      Token'ı sil
                    </button>
                  )}
                </div>
              </Field>

              <Field
                label="Env var (opsiyonel)"
                hint="Keychain'de yoksa bu env var'dan okunur. ~/.config/gh-tokens/*.env ile eski kurulumdan geçiş için."
              >
                <input
                  value={a.envVar ?? ''}
                  onChange={(e) => updateAccount(a.id, { envVar: e.target.value || null })}
                  placeholder="GH_TOKEN_PERSONAL"
                  className="input font-mono text-xs"
                />
              </Field>
            </div>
          );
        })}
      </div>

      <button className="btn-ghost w-full" onClick={addAccount}>
        + Hesap ekle
      </button>
    </section>
  );
}

// --- Categories tab -----------------------------------------------------

function CategoriesTab({
  cfg,
  setCfg,
  onAutofill,
}: {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  onAutofill: () => void;
}) {
  const updateCategory = (idx: number, patch: Partial<CategoryConfig>) => {
    setCfg((c) => ({
      ...c,
      categories: c.categories.map((cat, i) => (i === idx ? { ...cat, ...patch } : cat)),
    }));
  };
  const removeCategory = (idx: number) => {
    setCfg((c) => ({
      ...c,
      categories: c.categories.filter((_, i) => i !== idx),
    }));
  };
  const addCategory = () => {
    setCfg((c) => ({
      ...c,
      categories: [
        ...c.categories,
        {
          name: '',
          accountId: c.accounts[0]?.id ?? '',
          nested: true,
          hide: [],
        },
      ],
    }));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-[11px] text-panel-muted flex-1">
          Kategoriler <span className="font-mono">baseDir</span> altındaki klasörlerdir. Her kategori bir hesaba bağlanır.
        </p>
        <button className="btn-ghost text-[11px]" onClick={onAutofill}>
          Base klasörden otomatik doldur
        </button>
      </div>

      {cfg.categories.length === 0 && (
        <div className="border border-dashed border-panel-border rounded-lg p-5 text-center text-panel-muted text-sm">
          Henüz kategori yok. "Otomatik doldur" ile klasörlerden çekebilirsin.
        </div>
      )}

      <div className="space-y-2">
        {cfg.categories.map((cat, i) => (
          <div key={i} className="border border-panel-border rounded-lg p-3 grid grid-cols-[1fr_200px_auto_auto] gap-2 items-center">
            <input
              value={cat.name}
              onChange={(e) => updateCategory(i, { name: e.target.value })}
              placeholder="klasör adı"
              className="input font-mono"
            />
            <select
              value={cat.accountId}
              onChange={(e) => updateCategory(i, { accountId: e.target.value })}
              className="input"
            >
              <option value="">— hesap seç —</option>
              {cfg.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.id})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-panel-muted">
              <input
                type="checkbox"
                checked={cat.nested}
                onChange={(e) => updateCategory(i, { nested: e.target.checked })}
              />
              nested
            </label>
            <button
              onClick={() => removeCategory(i)}
              className="btn-ghost !py-1 !px-2 text-[11px] text-panel-danger"
              title="Kategoriyi sil"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button className="btn-ghost w-full" onClick={addCategory}>
        + Kategori ekle
      </button>
    </section>
  );
}

// --- Shared tiny helpers ------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-panel-muted">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-panel-muted">{hint}</div>}
    </label>
  );
}

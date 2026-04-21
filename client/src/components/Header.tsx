import type { AccountConfig, AccountsInfo } from '../lib/types';
import { useI18n } from '../lib/i18n';

interface HeaderProps {
  configuredAccounts: AccountConfig[];
  accounts: AccountsInfo | null;
  totalRepos: number;
  onRefresh: () => void;
  onClone: () => void;
  onSettings: () => void;
  refreshing: boolean;
}

export function Header({
  configuredAccounts,
  accounts,
  totalRepos,
  onRefresh,
  onClone,
  onSettings,
  refreshing,
}: HeaderProps) {
  const { lang, setLang, t } = useI18n();
  const nextLang = lang === 'tr' ? 'en' : 'tr';

  return (
    <header className="sticky top-0 z-10 backdrop-blur-xl bg-panel-bg/80 border-b border-panel-border">
      <div className="px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-panel-accent to-panel-accent2" />
          <span className="font-mono text-sm font-bold tracking-wider text-panel-text">pb-panel</span>
          <span className="text-xs text-panel-muted">· ProjectBase</span>
          <span className="text-xs text-panel-muted ml-3">{totalRepos} {t('header.repos')}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {configuredAccounts.map((a, i) => (
            <AccountBadge
              key={a.id}
              label={a.label}
              info={accounts?.[a.id] ?? null}
              tone={i % 2 === 0 ? 'accent' : 'accent2'}
            />
          ))}
        </div>

        <button
          onClick={() => setLang(nextLang)}
          className="btn-ghost !px-2 font-mono text-[11px]"
          title={t('header.toggleLanguage')}
          aria-label={t('header.language')}
        >
          🌐 {lang.toUpperCase()}
        </button>

        <button onClick={onRefresh} className="btn-ghost" disabled={refreshing}>
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          {refreshing ? t('header.refreshing') : t('header.refresh')}
        </button>

        <button onClick={onClone} className="btn-primary">
          <span>+</span> {t('header.clone')}
        </button>

        <button onClick={onSettings} className="btn-ghost" title={t('header.settings')}>
          ⚙
        </button>
      </div>
    </header>
  );
}

type BadgeInfo = { login: string; name: string; avatar: string } | null;

function AccountBadge({
  label,
  info,
  tone,
}: {
  label: string;
  info: BadgeInfo;
  tone: 'accent' | 'accent2';
}) {
  const color =
    tone === 'accent'
      ? 'text-panel-accent border-panel-accent/40'
      : 'text-panel-accent2 border-panel-accent2/40';
  return (
    <div className={`chip ${color}`} title={info?.name || ''}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}: {info?.login || '—'}
    </div>
  );
}

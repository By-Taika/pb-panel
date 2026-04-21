import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import type { Commit, ConflictState, RepoInfo, RepoMeta } from '../lib/types';
import { BranchesPanel } from './BranchesPanel';
import { PullRequestsPanel } from './PullRequestsPanel';
import { ConflictsPanel } from './ConflictsPanel';

interface Props {
  repo: RepoInfo;
  onClose: () => void;
  onToast: (msg: string, ok: boolean) => void;
  onRefresh: () => void;
}

type Tab = 'overview' | 'branches' | 'prs' | 'conflicts';

export function RepoDrawer({ repo, onClose, onToast, onRefresh }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('overview');
  const [conflictBadge, setConflictBadge] = useState<ConflictState | null>(null);

  // Lightweight conflict check for tab badge — refreshes whenever the drawer opens or repo id changes.
  useEffect(() => {
    api.conflicts(repo.category, repo.name, repo.subCategory)
      .then(setConflictBadge)
      .catch(() => setConflictBadge(null));
  }, [repo.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const conflictCount = conflictBadge?.files.length || 0;
  const conflictActive = conflictBadge?.inMerge || conflictBadge?.inRebase || conflictCount > 0;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="close drawer"
      />
      <aside className="relative w-full max-w-[620px] bg-panel-bg border-l border-panel-border flex flex-col animate-in slide-in-from-right duration-200">
        <header className="flex items-start justify-between gap-3 p-4 border-b border-panel-border">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-bold text-panel-text truncate">{repo.name}</h2>
            <div className="text-[11px] text-panel-muted mt-0.5">
              {repo.category}
              {repo.subCategory ? ` · ${repo.subCategory}` : ''}
              {repo.branch ? ` · ⎇ ${repo.branch}` : ''}
            </div>
            {repo.owner && repo.repoName && (
              <a
                href={`https://github.com/${repo.owner}/${repo.repoName}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-panel-accent hover:underline"
              >
                {repo.owner}/{repo.repoName} ↗
              </a>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost !py-1 !px-2" title={t('drawer.close')}>
            ✕
          </button>
        </header>

        <nav className="flex border-b border-panel-border bg-panel-bg text-xs">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            {t('drawer.tab.overview')}
          </TabButton>
          <TabButton active={tab === 'branches'} onClick={() => setTab('branches')}>
            {t('drawer.tab.branches')}
          </TabButton>
          <TabButton active={tab === 'prs'} onClick={() => setTab('prs')}>
            {t('drawer.tab.prs')}
          </TabButton>
          <TabButton
            active={tab === 'conflicts'}
            onClick={() => setTab('conflicts')}
            badge={conflictActive ? conflictCount || '!' : undefined}
            highlight={conflictActive}
          >
            {t('drawer.tab.conflicts')}
          </TabButton>
        </nav>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {tab === 'overview' && <OverviewTab repo={repo} />}
          {tab === 'branches' && <BranchesPanel repo={repo} onToast={onToast} onChanged={onRefresh} />}
          {tab === 'prs' && <PullRequestsPanel repo={repo} onToast={onToast} onChanged={onRefresh} />}
          {tab === 'conflicts' && <ConflictsPanel repo={repo} onToast={onToast} onChanged={onRefresh} />}
        </div>
      </aside>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  badge,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number | string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
        active
          ? 'border-panel-accent text-panel-accent font-medium'
          : 'border-transparent text-panel-muted hover:text-panel-text'
      }`}
    >
      {children}
      {badge !== undefined && (
        <span
          className={`text-[9px] px-1.5 rounded-full font-mono ${
            highlight ? 'bg-panel-danger text-white' : 'bg-panel-raised text-panel-muted'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function OverviewTab({ repo }: { repo: RepoInfo }) {
  const t = useT();
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [meta, setMeta] = useState<RepoMeta | null | 'loading'>('loading');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.repoLog(repo.category, repo.name, repo.subCategory, 30)
      .then((c) => {
        if (!cancelled) setCommits(c);
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message || String(e));
      });
    api.repoMeta(repo.category, repo.name, repo.subCategory)
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repo.id]);

  return (
    <div className="space-y-5">
      {/* GitHub meta */}
      <section>
        <SectionHeader title={t('overview.github')} loading={meta === 'loading'} />
        {meta === 'loading' ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonStat key={i} />
            ))}
          </div>
        ) : meta === null ? (
          <div className="text-xs text-panel-muted">{t('overview.githubUnavailable')}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label={t('overview.stat.default')} value={meta.defaultBranch} />
              <Stat label={t('overview.stat.stars')} value={String(meta.stars)} />
              <Stat label={t('overview.stat.openIssues')} value={String(meta.openIssues)} />
              <Stat label={t('overview.stat.visibility')} value={meta.private ? t('overview.visibility.private') : t('overview.visibility.public')} />
              {meta.language && <Stat label={t('overview.stat.language')} value={meta.language} />}
              <Stat label={t('overview.stat.pushed')} value={new Date(meta.pushedAt).toLocaleString()} />
            </div>
            {meta.description && (
              <p className="text-xs text-panel-muted mt-2">{meta.description}</p>
            )}
          </>
        )}
      </section>

      {/* Local state */}
      <section>
        <SectionHeader title={t('overview.localState')} />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label={t('overview.stat.branch')} value={repo.branch || '—'} />
          <Stat label={t('overview.stat.dirtyFiles')} value={String(repo.dirty)} />
          <Stat label={t('overview.stat.ahead')} value={String(repo.ahead)} />
          <Stat label={t('overview.stat.behind')} value={String(repo.behind)} />
          <Stat label={t('overview.stat.remoteUpdates')} value={repo.remoteUpdates === null ? '—' : String(repo.remoteUpdates)} />
          <Stat label={t('overview.stat.account')} value={repo.account} />
        </div>
      </section>

      {/* Commit history */}
      <section>
        <SectionHeader title={t('overview.commitHistory')} loading={commits === null && !err} />
        {err ? (
          <div className="text-xs text-panel-danger">{err}</div>
        ) : commits === null ? (
          <ol className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="border-l-2 border-panel-border pl-3 space-y-1">
                <SkeletonLine width="w-10/12" />
                <SkeletonLine width="w-1/2" className="h-2" />
              </li>
            ))}
          </ol>
        ) : commits.length === 0 ? (
          <div className="text-xs text-panel-muted">{t('overview.noCommits')}</div>
        ) : (
          <ol className="space-y-2">
            {commits.map((c) => (
              <li key={c.hash} className="border-l-2 border-panel-border pl-3">
                <div className="text-panel-text line-clamp-2 text-xs">{c.subject}</div>
                <div className="text-[10px] text-panel-muted font-mono mt-0.5">
                  <span className="text-panel-accent">{c.short}</span> · {c.author} · {c.relativeTime}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, loading }: { title: string; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-[10px] uppercase tracking-widest text-panel-muted">{title}</h3>
      {loading && <Spinner />}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-panel-muted border-t-panel-accent animate-spin"
      aria-hidden
    />
  );
}

function SkeletonStat() {
  return (
    <div className="border border-panel-border rounded px-2 py-1.5 space-y-1">
      <SkeletonLine width="w-1/3" className="h-2" />
      <SkeletonLine width="w-2/3" />
    </div>
  );
}

function SkeletonLine({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return (
    <div
      className={`h-3 rounded bg-panel-raised animate-pulse ${width} ${className}`}
      aria-hidden
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-panel-border rounded px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-panel-muted">{label}</div>
      <div className="text-panel-text truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

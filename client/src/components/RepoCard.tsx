import { useState } from 'react';
import type { RepoInfo } from '../lib/types';
import { api } from '../lib/api';
import { RepoDrawer } from './RepoDrawer';

interface RepoCardProps {
  repo: RepoInfo;
  onAction: (msg: string, ok: boolean) => void;
  onRefresh: () => void;
}

export function RepoCard({ repo, onAction, onRefresh }: RepoCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const run = async (label: string, fn: () => Promise<{ ok: boolean; output: string }>) => {
    setBusy(label);
    try {
      const res = await fn();
      onAction(`${repo.name}: ${res.output || label} ${res.ok ? '✓' : '✗'}`.slice(0, 200), res.ok);
      if (res.ok && (label === 'pull' || label === 'fetch')) onRefresh();
    } catch (e: any) {
      onAction(`${repo.name}: ${e.message}`, false);
    } finally {
      setBusy(null);
    }
  };

  // Stable per-account tone: hash the account id so each account gets a
  // consistent colour across renders without hardcoding any account name.
  const accountTone = (() => {
    let h = 0;
    for (let i = 0; i < repo.account.length; i++) h = (h * 31 + repo.account.charCodeAt(i)) | 0;
    return (h & 1) === 0
      ? 'text-panel-accent border-panel-accent/40'
      : 'text-panel-accent2 border-panel-accent2/40';
  })();

  return (
    <div className="card group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-bold text-panel-text truncate" title={repo.name}>
              {repo.name}
            </h3>
            <span className={`chip ${accountTone}`}>{repo.account}</span>
          </div>
          {repo.owner && repo.repoName && (
            <a
              href={`https://github.com/${repo.owner}/${repo.repoName}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-panel-muted hover:text-panel-accent"
            >
              {repo.owner}/{repo.repoName} ↗
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {repo.branch && (
          <span className="chip border-panel-border text-panel-text">
            <span className="opacity-60">⎇</span>
            {repo.branch}
          </span>
        )}
        {repo.dirty > 0 && <span className="chip border-panel-warn/40 text-panel-warn">● {repo.dirty} dirty</span>}
        {repo.ahead > 0 && <span className="chip border-panel-accent/40 text-panel-accent">↑ {repo.ahead}</span>}
        {repo.behind > 0 && <span className="chip border-panel-danger/40 text-panel-danger">↓ {repo.behind}</span>}
        {!repo.hasUpstream && repo.branch && (
          <span className="chip border-panel-border text-panel-muted">no upstream</span>
        )}
        {repo.remoteUpdates != null && repo.remoteUpdates > 0 && (
          <span
            className="chip border-panel-accent/40 text-panel-accent"
            title={`Remote'da yeni commit var (fetch edilmedi):\n${repo.updatedBranches.join('\n')}`}
          >
            ↯ {repo.remoteUpdates} update
          </span>
        )}
      </div>

      {repo.lastCommit && (
        <div className="text-xs text-panel-muted mb-3 border-l-2 border-panel-border pl-2">
          <div className="text-panel-text line-clamp-2" title={repo.lastCommit.subject}>
            {repo.lastCommit.subject}
          </div>
          <div className="font-mono text-[10px] mt-0.5">
            <span className="text-panel-accent">{repo.lastCommit.short}</span> · {repo.lastCommit.author} ·{' '}
            {repo.lastCommit.relativeTime}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          className="btn-ghost"
          onClick={() => run('pull', () => api.pull(repo.category, repo.name, repo.subCategory))}
          disabled={busy !== null}
        >
          {busy === 'pull' ? <span className="spinner" /> : <span>↓</span>} Pull
        </button>
        <button
          className="btn-ghost"
          onClick={() => run('fetch', () => api.fetchRemote(repo.category, repo.name, repo.subCategory))}
          disabled={busy !== null}
        >
          {busy === 'fetch' ? <span className="spinner" /> : <span>⟳</span>} Fetch
        </button>
        <button
          className="btn-ghost"
          onClick={() => run('open', () => api.openIde(repo.category, repo.name, repo.subCategory))}
          disabled={busy !== null}
        >
          {busy === 'open' ? <span className="spinner" /> : <span>⎋</span>} Open
        </button>
        <button
          className="btn-ghost ml-auto"
          onClick={() => setShowDrawer(true)}
          title="Geçmiş & PR'lar"
        >
          ⓘ
        </button>
      </div>

      {showDrawer && <RepoDrawer repo={repo} onClose={() => setShowDrawer(false)} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Commit, OpenPr, RepoInfo, RepoMeta } from '../lib/types';

interface Props {
  repo: RepoInfo;
  onClose: () => void;
}

export function RepoDrawer({ repo, onClose }: Props) {
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [meta, setMeta] = useState<RepoMeta | null | 'loading'>('loading');
  const [prs, setPrs] = useState<OpenPr[] | 'loading'>('loading');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Fire all three in parallel but let each render as soon as it resolves,
    // so the drawer fills in progressively instead of waiting on the slowest.
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
    api.repoPrs(repo.category, repo.name, repo.subCategory)
      .then((p) => {
        if (!cancelled) setPrs(p ?? []);
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repo.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="close drawer"
      />
      <aside className="relative w-full max-w-[560px] bg-panel-bg border-l border-panel-border flex flex-col animate-in slide-in-from-right duration-200">
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
          <button onClick={onClose} className="btn-ghost !py-1 !px-2" title="Close (Esc)">
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
          {/* GitHub meta */}
          <section>
            <SectionHeader title="GitHub" loading={meta === 'loading'} />
            {meta === 'loading' ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonStat key={i} />
                ))}
              </div>
            ) : meta === null ? (
              <div className="text-xs text-panel-muted">GitHub meta erişilemedi (token/özel repo?)</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="default" value={meta.defaultBranch} />
                  <Stat label="stars" value={String(meta.stars)} />
                  <Stat label="open issues" value={String(meta.openIssues)} />
                  <Stat label="visibility" value={meta.private ? 'private' : 'public'} />
                  {meta.language && <Stat label="language" value={meta.language} />}
                  <Stat label="pushed" value={new Date(meta.pushedAt).toLocaleString('tr-TR')} />
                </div>
                {meta.description && (
                  <p className="text-xs text-panel-muted mt-2">{meta.description}</p>
                )}
              </>
            )}
          </section>

          {/* PRs */}
          <section>
            <SectionHeader
              title={`Open PRs${prs !== 'loading' ? ` (${prs.length})` : ''}`}
              loading={prs === 'loading'}
            />
            {prs === 'loading' ? (
              <ul className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i}>
                    <SkeletonLine width="w-11/12" />
                    <SkeletonLine width="w-1/3" className="mt-1 h-2" />
                  </li>
                ))}
              </ul>
            ) : prs.length === 0 ? (
              <div className="text-xs text-panel-muted">Açık PR yok</div>
            ) : (
              <ul className="space-y-1.5">
                {prs.map((pr) => (
                  <li key={pr.number} className="text-xs">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-panel-accent"
                    >
                      <span className="font-mono text-panel-muted">#{pr.number}</span>{' '}
                      {pr.draft && (
                        <span className="chip border-panel-border text-panel-muted !text-[9px]">
                          draft
                        </span>
                      )}{' '}
                      {pr.title}
                    </a>
                    <div className="text-[10px] text-panel-muted">
                      {pr.author} · {new Date(pr.updated).toLocaleString('tr-TR')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Commit history */}
          <section>
            <SectionHeader title="Commit history" loading={commits === null && !err} />
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
              <div className="text-xs text-panel-muted">Henüz commit yok</div>
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
      </aside>
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

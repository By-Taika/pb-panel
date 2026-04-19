import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Commit, OpenPr, RepoInfo, RepoMeta } from '../lib/types';

interface Props {
  repo: RepoInfo;
  onClose: () => void;
}

export function RepoDrawer({ repo, onClose }: Props) {
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [prs, setPrs] = useState<OpenPr[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, m, p] = await Promise.all([
          api.repoLog(repo.category, repo.name, repo.subCategory, 30),
          api.repoMeta(repo.category, repo.name, repo.subCategory).catch(() => null),
          api.repoPrs(repo.category, repo.name, repo.subCategory).catch(() => [] as OpenPr[]),
        ]);
        if (cancelled) return;
        setCommits(c);
        setMeta(m);
        setPrs(p ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      }
    })();
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
      <aside className="relative w-full max-w-[560px] bg-panel-bg border-l border-panel-border flex flex-col">
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
          {meta && (
            <section>
              <h3 className="text-[10px] uppercase tracking-widest text-panel-muted mb-2">
                GitHub
              </h3>
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
            </section>
          )}

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-panel-muted mb-2">
              Open PRs {prs ? `(${prs.length})` : ''}
            </h3>
            {prs === null ? (
              <div className="text-xs text-panel-muted">…</div>
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
                      {pr.draft && <span className="chip border-panel-border text-panel-muted !text-[9px]">draft</span>}{' '}
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

          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-panel-muted mb-2">
              Commit history
            </h3>
            {err ? (
              <div className="text-xs text-panel-danger">{err}</div>
            ) : commits === null ? (
              <div className="text-xs text-panel-muted">…</div>
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

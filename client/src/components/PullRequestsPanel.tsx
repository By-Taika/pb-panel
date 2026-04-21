import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import type { MergeMethod, OpenPr, PrDetail, RepoInfo } from '../lib/types';

interface Props {
  repo: RepoInfo;
  onToast: (msg: string, ok: boolean) => void;
  onChanged: () => void;
}

export function PullRequestsPanel({ repo, onToast, onChanged }: Props) {
  const t = useT();
  const [list, setList] = useState<OpenPr[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<PrDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => {
    api.repoPrs(repo.category, repo.name, repo.subCategory).then(setList).catch(() => setList([]));
  };

  useEffect(() => {
    reload();
  }, [repo.id]);

  useEffect(() => {
    if (expanded === null) {
      setDetail(null);
      return;
    }
    api.prDetail(repo.category, repo.name, repo.subCategory, expanded).then(setDetail).catch(() => setDetail(null));
  }, [expanded, repo.id]);

  const wrap = async <T,>(key: string, fn: () => Promise<T>, okMsgFallback: string) => {
    setBusy(key);
    try {
      const res = await fn();
      const msg = typeof res === 'string' ? res : okMsgFallback;
      onToast(msg, true);
      reload();
      onChanged();
      if (expanded !== null) {
        api.prDetail(repo.category, repo.name, repo.subCategory, expanded).then(setDetail).catch(() => {});
      }
    } catch (e: any) {
      onToast(e?.message || String(e), false);
    } finally {
      setBusy(null);
    }
  };

  if (!repo.owner || !repo.repoName) {
    return <div className="text-xs text-panel-muted">{t('prs.noRemote')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-panel-muted">
          {list ? t('prs.titleN', { n: list.length }) : t('prs.title')}
        </h3>
        <button
          className="btn-ghost !py-0.5 !px-2 !text-[10px]"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? t('prs.closeForm') : t('prs.newButton')}
        </button>
      </div>

      {showCreate && (
        <CreatePrForm
          repo={repo}
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
            onChanged();
          }}
          onToast={onToast}
        />
      )}

      {list === null ? (
        <div className="text-xs text-panel-muted">{t('branches.loading')}</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-panel-muted">{t('prs.noPrs')}</div>
      ) : (
        <ul className="space-y-2">
          {list.map((pr) => (
            <li
              key={pr.number}
              className={`rounded border text-xs ${
                expanded === pr.number
                  ? 'border-panel-accent bg-panel-raised'
                  : 'border-panel-border hover:border-panel-accent/50'
              }`}
            >
              <button
                className="w-full flex items-start gap-2 px-2.5 py-2 text-left"
                onClick={() => setExpanded(expanded === pr.number ? null : pr.number)}
              >
                <span className="font-mono text-panel-muted flex-shrink-0">#{pr.number}</span>
                <span className="flex-1 min-w-0">
                  <div className="text-panel-text truncate">{pr.title}</div>
                  <div className="text-[10px] text-panel-muted mt-0.5">
                    {pr.author} · {new Date(pr.updated).toLocaleString()}
                    {pr.draft && <span className="ml-2 chip border-panel-border text-panel-muted !text-[9px]">{t('prs.draft')}</span>}
                  </div>
                </span>
              </button>

              {expanded === pr.number && (
                <div className="border-t border-panel-border p-2.5 space-y-2">
                  {!detail ? (
                    <div className="text-[10px] text-panel-muted">{t('prs.loadingDetail')}</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <Stat label={t('prs.stat.head')} value={detail.headRef} />
                        <Stat label={t('prs.stat.base')} value={detail.baseRef} />
                        <Stat label={t('prs.stat.mergeable')} value={mergeableLabel(detail.mergeable, detail.mergeableState, t)} />
                        <Stat label={t('prs.stat.autoMerge')} value={detail.autoMergeEnabled ? t('prs.autoMergeOn') : t('prs.autoMergeOff')} />
                      </div>

                      {detail.body && (
                        <details className="text-[10px] text-panel-muted">
                          <summary className="cursor-pointer">{t('prs.description')}</summary>
                          <pre className="whitespace-pre-wrap mt-1 bg-black/30 p-2 rounded max-h-40 overflow-y-auto">
                            {detail.body}
                          </pre>
                        </details>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <MergeActions
                          pr={detail}
                          busy={busy}
                          onMerge={(method) =>
                            wrap(
                              `merge-${pr.number}-${method}`,
                              () => api.prMerge(repo.category, repo.name, repo.subCategory, pr.number, method),
                              t('prs.mergedOk', { n: pr.number, method }),
                            )
                          }
                          onEnableAuto={(method) =>
                            wrap(
                              `auto-${pr.number}`,
                              () => api.prEnableAutoMerge(repo.category, repo.name, repo.subCategory, pr.number, method),
                              t('prs.autoEnabled', { n: pr.number }),
                            )
                          }
                          onDisableAuto={() =>
                            wrap(
                              `auto-off-${pr.number}`,
                              () => api.prDisableAutoMerge(repo.category, repo.name, repo.subCategory, pr.number),
                              t('prs.autoDisabled', { n: pr.number }),
                            )
                          }
                        />
                        <a href={pr.url} target="_blank" rel="noreferrer" className="btn-ghost !py-0.5 !text-[10px]">
                          {t('prs.openInGithub')}
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function mergeableLabel(mergeable: boolean | null, state: string | null, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (mergeable === true) return t('prs.mergeable.clean', { s: state || 'clean' });
  if (mergeable === false) return t('prs.mergeable.conflict', { s: state || 'dirty' });
  return state || t('prs.mergeable.calculating');
}

interface MergeActionsProps {
  pr: PrDetail;
  busy: string | null;
  onMerge: (m: MergeMethod) => void;
  onEnableAuto: (m: MergeMethod) => void;
  onDisableAuto: () => void;
}

function MergeActions({ pr, busy, onMerge, onEnableAuto, onDisableAuto }: MergeActionsProps) {
  const t = useT();
  const [method, setMethod] = useState<MergeMethod>('squash');
  const disabled = busy !== null || pr.draft;
  return (
    <>
      <select
        className="input !py-0.5 !text-[10px] !w-auto"
        value={method}
        onChange={(e) => setMethod(e.target.value as MergeMethod)}
      >
        <option value="squash">squash</option>
        <option value="merge">merge</option>
        <option value="rebase">rebase</option>
      </select>
      <button
        className="btn-primary !py-0.5 !text-[10px]"
        disabled={disabled || pr.mergeable === false}
        onClick={() => {
          if (!confirm(t('prs.mergeConfirm', { n: pr.number, method }))) return;
          onMerge(method);
        }}
        title={pr.mergeable === false ? t('prs.mergeConflictTitle') : ''}
      >
        {t('prs.mergeNow')}
      </button>
      {pr.autoMergeEnabled ? (
        <button
          className="btn-ghost !py-0.5 !text-[10px] text-panel-danger"
          disabled={busy !== null}
          onClick={onDisableAuto}
        >
          {t('prs.disableAuto')}
        </button>
      ) : (
        <button
          className="btn-ghost !py-0.5 !text-[10px]"
          disabled={disabled}
          onClick={() => onEnableAuto(method)}
        >
          {t('prs.enableAuto', { method })}
        </button>
      )}
    </>
  );
}

interface CreatePrFormProps {
  repo: RepoInfo;
  onCancel: () => void;
  onCreated: () => void;
  onToast: (msg: string, ok: boolean) => void;
}

function CreatePrForm({ repo, onCancel, onCreated, onToast }: CreatePrFormProps) {
  const t = useT();
  const [head, setHead] = useState(repo.branch || '');
  const [base, setBase] = useState('main');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !head.trim() || !base.trim()) {
      onToast(t('prs.form.required'), false);
      return;
    }
    setBusy(true);
    try {
      const pr = await api.prCreate(repo.category, repo.name, repo.subCategory, head.trim(), base.trim(), title.trim(), body.trim(), draft);
      onToast(t('prs.form.created', { n: pr.number }), true);
      onCreated();
    } catch (e: any) {
      onToast(e?.message || String(e), false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded border border-panel-border bg-panel-raised space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-panel-muted">
          {t('prs.form.head')}
          <input className="input !py-1 !text-xs mt-0.5" value={head} onChange={(e) => setHead(e.target.value)} />
        </label>
        <label className="block text-[10px] text-panel-muted">
          {t('prs.form.base')}
          <input className="input !py-1 !text-xs mt-0.5" value={base} onChange={(e) => setBase(e.target.value)} />
        </label>
      </div>
      <label className="block text-[10px] text-panel-muted">
        {t('prs.form.title')}
        <input className="input !py-1 !text-xs mt-0.5" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-[10px] text-panel-muted">
        {t('prs.form.body')}
        <textarea
          className="input !py-1 !text-xs mt-0.5 h-24 font-mono"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[10px] text-panel-muted">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          {t('prs.form.draft')}
        </label>
        <div className="flex items-center gap-1.5">
          <button className="btn-ghost !py-1 !text-xs" onClick={onCancel} disabled={busy}>
            {t('prs.form.cancel')}
          </button>
          <button className="btn-primary !py-1 !text-xs" onClick={submit} disabled={busy}>
            {t('prs.form.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-panel-border rounded px-2 py-1">
      <div className="text-[9px] uppercase tracking-widest text-panel-muted">{label}</div>
      <div className="text-panel-text truncate font-mono" title={value}>
        {value}
      </div>
    </div>
  );
}

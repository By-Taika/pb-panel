import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import type { BranchInfo, RepoInfo, StashEntry } from '../lib/types';

interface Props {
  repo: RepoInfo;
  onToast: (msg: string, ok: boolean) => void;
  onChanged: () => void;
}

export function BranchesPanel({ repo, onToast, onChanged }: Props) {
  const t = useT();
  const [branches, setBranches] = useState<BranchInfo[] | null>(null);
  const [stashes, setStashes] = useState<StashEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const reload = () => {
    api.branches(repo.category, repo.name, repo.subCategory).then(setBranches);
    api.stashes(repo.category, repo.name, repo.subCategory).then(setStashes);
  };

  useEffect(() => {
    reload();
  }, [repo.id]);

  const wrap = async <T,>(key: string, fn: () => Promise<T>, okMsg: string) => {
    setBusy(key);
    try {
      const res: any = await fn();
      const ok = res?.ok !== false;
      onToast(ok ? okMsg : (res?.output || 'error'), ok);
      reload();
      onChanged();
    } catch (e: any) {
      onToast(e?.message || String(e), false);
    } finally {
      setBusy(null);
    }
  };

  const localBranches = (branches || []).filter((b) => !b.isRemote);
  const remoteBranches = (branches || []).filter((b) => b.isRemote);

  return (
    <div className="space-y-5">
      {/* Branch creation */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-panel-muted">{t('branches.title')}</h3>
          <button onClick={() => setShowCreate((v) => !v)} className="btn-ghost !py-0.5 !px-2 !text-[10px]">
            {showCreate ? t('branches.closeForm') : t('branches.newButton')}
          </button>
        </div>

        {showCreate && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder={t('branches.newPlaceholder')}
              className="input flex-1 !py-1 !text-xs"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newBranchName.trim()) {
                  wrap(
                    'create',
                    () => api.createBranch(repo.category, repo.name, repo.subCategory, newBranchName.trim(), true),
                    t('branches.created', { name: newBranchName.trim() })
                  );
                  setNewBranchName('');
                  setShowCreate(false);
                }
              }}
            />
            <button
              className="btn-primary !py-1 !text-xs"
              disabled={!newBranchName.trim() || busy === 'create'}
              onClick={() => {
                wrap(
                  'create',
                  () => api.createBranch(repo.category, repo.name, repo.subCategory, newBranchName.trim(), true),
                  t('branches.created', { name: newBranchName.trim() })
                );
                setNewBranchName('');
                setShowCreate(false);
              }}
            >
              {t('branches.createAndCheckout')}
            </button>
          </div>
        )}

        {branches === null ? (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-panel-raised animate-pulse rounded" />
            ))}
          </div>
        ) : localBranches.length === 0 ? (
          <div className="text-xs text-panel-muted">{t('branches.noLocal')}</div>
        ) : (
          <ul className="space-y-1">
            {localBranches.map((b) => (
              <BranchRow
                key={b.name}
                branch={b}
                busy={busy}
                onCheckout={() =>
                  wrap(`co-${b.name}`, () =>
                    api.checkoutBranch(repo.category, repo.name, repo.subCategory, b.name),
                  t('branches.checkedOut', { name: b.name }))
                }
                onPush={() =>
                  wrap(`push-${b.name}`, () =>
                    api.pushBranch(repo.category, repo.name, repo.subCategory, b.name, !b.upstream),
                  t('branches.pushed', { name: b.name }))
                }
                onDelete={(force) =>
                  wrap(`del-${b.name}`, () =>
                    api.deleteBranch(repo.category, repo.name, repo.subCategory, b.name, force),
                  t('branches.deleted', { name: b.name }))
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Remote branches */}
      {remoteBranches.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-panel-muted mb-2">
            {t('branches.remoteCount', { n: remoteBranches.length })}
          </h3>
          <ul className="space-y-1 max-h-52 overflow-y-auto">
            {remoteBranches.map((b) => (
              <li key={b.name} className="flex items-center justify-between px-2 py-1 rounded hover:bg-panel-raised text-xs">
                <div className="min-w-0">
                  <div className="font-mono text-panel-muted truncate">⎇ {b.name}</div>
                  {b.lastCommitSubject && (
                    <div className="text-[10px] text-panel-muted truncate">{b.lastCommitSubject}</div>
                  )}
                </div>
                <button
                  className="btn-ghost !py-0 !px-1.5 !text-[10px]"
                  disabled={busy !== null}
                  onClick={() => {
                    const local = b.name.includes('/') ? b.name.split('/').slice(1).join('/') : b.name;
                    wrap(
                      `track-${b.name}`,
                      () => api.checkoutBranch(repo.category, repo.name, repo.subCategory, local),
                      t('branches.remoteCheckedOut', { name: local })
                    );
                  }}
                >
                  {t('branches.remoteCheckout')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stashes */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-panel-muted">
            {stashes && stashes.length > 0 ? t('branches.stashTitleN', { n: stashes.length }) : t('branches.stashTitle')}
          </h3>
          <button
            className="btn-ghost !py-0.5 !px-2 !text-[10px]"
            disabled={busy === 'stash-save' || repo.dirty === 0}
            onClick={() =>
              wrap('stash-save', () =>
                api.stashSave(repo.category, repo.name, repo.subCategory, `pb-panel ${new Date().toISOString()}`),
              t('branches.stashSaved'))
            }
            title={repo.dirty === 0 ? t('branches.noDirty') : t('branches.stashDirtyTitle')}
          >
            {t('branches.stashSave')}
          </button>
        </div>

        {stashes === null ? (
          <div className="text-xs text-panel-muted">{t('branches.loading')}</div>
        ) : stashes.length === 0 ? (
          <div className="text-xs text-panel-muted">{t('branches.noStashes')}</div>
        ) : (
          <ul className="space-y-1">
            {stashes.map((s) => (
              <li key={s.index} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-panel-raised text-xs">
                <div className="min-w-0">
                  <div className="font-mono text-panel-text truncate">stash@{`{${s.index}}`}</div>
                  <div className="text-[10px] text-panel-muted truncate">
                    {s.message} · {s.relativeTime}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="btn-ghost !py-0 !px-1.5 !text-[10px]"
                    disabled={busy !== null}
                    onClick={() =>
                      wrap(`pop-${s.index}`, () =>
                        api.stashPop(repo.category, repo.name, repo.subCategory, s.index),
                      t('branches.stashPopped'))
                    }
                  >
                    pop
                  </button>
                  <button
                    className="btn-ghost !py-0 !px-1.5 !text-[10px] text-panel-danger"
                    disabled={busy !== null}
                    onClick={() => {
                      if (!confirm(t('branches.stashDropConfirm', { idx: s.index }))) return;
                      wrap(`drop-${s.index}`, () =>
                        api.stashDrop(repo.category, repo.name, repo.subCategory, s.index),
                      t('branches.stashDropped'));
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface BranchRowProps {
  branch: BranchInfo;
  busy: string | null;
  onCheckout: () => void;
  onPush: () => void;
  onDelete: (force: boolean) => void;
}

function BranchRow({ branch, busy, onCheckout, onPush, onDelete }: BranchRowProps) {
  const t = useT();
  const disabled = busy !== null;
  return (
    <li
      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs ${
        branch.isCurrent ? 'bg-panel-accent/15 border border-panel-accent/30' : 'hover:bg-panel-raised'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-mono truncate ${
              branch.isCurrent ? 'text-panel-accent font-bold' : 'text-panel-text'
            }`}
          >
            {branch.isCurrent && '● '}⎇ {branch.name}
          </span>
          {branch.upstream && (
            <span className="text-[10px] text-panel-muted font-mono">↔ {branch.upstream}</span>
          )}
          {branch.ahead > 0 && (
            <span className="chip border-green-500/40 text-green-400 !text-[9px]">↑{branch.ahead}</span>
          )}
          {branch.behind > 0 && (
            <span className="chip border-amber-500/40 text-amber-400 !text-[9px]">↓{branch.behind}</span>
          )}
        </div>
        {branch.lastCommitSubject && (
          <div className="text-[10px] text-panel-muted truncate mt-0.5">
            {branch.lastCommitSubject} · {branch.lastCommitRelative}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!branch.isCurrent && (
          <button onClick={onCheckout} disabled={disabled} className="btn-ghost !py-0 !px-1.5 !text-[10px]" title={t('branches.tipCheckout')}>
            →
          </button>
        )}
        <button
          onClick={onPush}
          disabled={disabled}
          className="btn-ghost !py-0 !px-1.5 !text-[10px]"
          title={branch.upstream ? t('branches.tipPush') : t('branches.tipPushUpstream')}
        >
          ↑
        </button>
        {!branch.isCurrent && (
          <button
            onClick={() => {
              if (!confirm(t('branches.deleteConfirm', { name: branch.name }))) return;
              onDelete(false);
            }}
            disabled={disabled}
            className="btn-ghost !py-0 !px-1.5 !text-[10px] text-panel-danger"
            title={t('branches.tipDelete')}
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
}

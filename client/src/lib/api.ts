import { invoke } from '@tauri-apps/api/core';
import type {
  AccountsInfo,
  BranchInfo,
  Category,
  Commit,
  Config,
  ConflictState,
  MergeMethod,
  OpenPr,
  PrDetail,
  RepoInfo,
  RepoMeta,
  StashEntry,
} from './types';

type ActionResult = { ok: boolean; output: string; path?: string };

export const api = {
  // --- Config ---
  getConfig(): Promise<Config> {
    return invoke<Config>('get_config');
  },
  saveConfig(cfg: Config): Promise<void> {
    return invoke<void>('save_config', { cfg });
  },
  health(): Promise<{ ok: boolean; configPath: string; version: number }> {
    return invoke<{ ok: boolean; configPath: string; version: number }>('health');
  },
  listSubfolders(path: string): Promise<string[]> {
    return invoke<string[]>('list_subfolders', { path });
  },

  // --- Tokens (keychain) ---
  accountHasToken(accountId: string): Promise<boolean> {
    return invoke<boolean>('account_has_token', { accountId });
  },
  setAccountToken(accountId: string, token: string): Promise<void> {
    return invoke<void>('set_account_token', { accountId, token });
  },
  deleteAccountToken(accountId: string): Promise<void> {
    return invoke<void>('delete_account_token', { accountId });
  },

  // --- Dashboard data ---
  accounts(): Promise<AccountsInfo> {
    return invoke<AccountsInfo>('accounts');
  },
  repos(): Promise<Record<Category, RepoInfo[]>> {
    return invoke<Record<Category, RepoInfo[]>>('repos');
  },
  repoInfo(category: Category, name: string, sub?: string | null): Promise<RepoInfo> {
    return invoke<RepoInfo>('repo_info', { category, name, sub: sub ?? null });
  },
  repoMeta(category: Category, name: string, sub?: string | null): Promise<RepoMeta | null> {
    return invoke<RepoMeta | null>('repo_meta', { category, name, sub: sub ?? null });
  },
  repoPrs(category: Category, name: string, sub?: string | null): Promise<OpenPr[]> {
    return invoke<OpenPr[]>('repo_prs', { category, name, sub: sub ?? null });
  },
  repoLog(category: Category, name: string, sub?: string | null, limit = 30): Promise<Commit[]> {
    return invoke<Commit[]>('repo_log', { category, name, sub: sub ?? null, limit });
  },

  // --- Actions ---
  pull(category: Category, name: string, sub?: string | null): Promise<ActionResult> {
    return invoke<ActionResult>('repo_pull', { category, name, sub: sub ?? null });
  },
  fetchRemote(category: Category, name: string, sub?: string | null): Promise<ActionResult> {
    return invoke<ActionResult>('repo_fetch', { category, name, sub: sub ?? null });
  },
  push(category: Category, name: string, sub?: string | null): Promise<ActionResult> {
    return invoke<ActionResult>('repo_push', { category, name, sub: sub ?? null });
  },
  openIde(category: Category, name: string, sub?: string | null, ide?: string): Promise<ActionResult> {
    return invoke<ActionResult>('repo_open', { category, name, sub: sub ?? null, ide: ide ?? null });
  },
  clone(category: Category, ownerRepo: string, targetName?: string, subCategory?: string): Promise<ActionResult> {
    return invoke<ActionResult>('repo_clone', {
      category,
      subCategory: subCategory ?? null,
      ownerRepo,
      targetName: targetName ?? null,
    });
  },

  // --- Branch management ---
  branches(category: Category, name: string, sub?: string | null): Promise<BranchInfo[]> {
    return invoke<BranchInfo[]>('repo_branches', { category, name, sub: sub ?? null });
  },
  checkoutBranch(category: Category, name: string, sub: string | null | undefined, branch: string): Promise<ActionResult> {
    return invoke<ActionResult>('branch_checkout', { category, name, sub: sub ?? null, branch });
  },
  createBranch(
    category: Category, name: string, sub: string | null | undefined,
    branch: string, checkout = true,
  ): Promise<ActionResult> {
    return invoke<ActionResult>('branch_create', { category, name, sub: sub ?? null, branch, checkout });
  },
  deleteBranch(
    category: Category, name: string, sub: string | null | undefined,
    branch: string, force = false,
  ): Promise<ActionResult> {
    return invoke<ActionResult>('branch_delete', { category, name, sub: sub ?? null, branch, force });
  },
  pushBranch(
    category: Category, name: string, sub: string | null | undefined,
    branch: string, setUpstream = true,
  ): Promise<ActionResult> {
    return invoke<ActionResult>('branch_push', { category, name, sub: sub ?? null, branch, setUpstream });
  },

  // --- Stash ---
  stashes(category: Category, name: string, sub?: string | null): Promise<StashEntry[]> {
    return invoke<StashEntry[]>('repo_stashes', { category, name, sub: sub ?? null });
  },
  stashSave(category: Category, name: string, sub: string | null | undefined, message?: string): Promise<ActionResult> {
    return invoke<ActionResult>('stash_save', { category, name, sub: sub ?? null, message: message ?? null });
  },
  stashPop(category: Category, name: string, sub: string | null | undefined, index: number): Promise<ActionResult> {
    return invoke<ActionResult>('stash_pop', { category, name, sub: sub ?? null, index });
  },
  stashDrop(category: Category, name: string, sub: string | null | undefined, index: number): Promise<ActionResult> {
    return invoke<ActionResult>('stash_drop', { category, name, sub: sub ?? null, index });
  },

  // --- Conflicts ---
  conflicts(category: Category, name: string, sub?: string | null): Promise<ConflictState> {
    return invoke<ConflictState>('repo_conflicts', { category, name, sub: sub ?? null });
  },
  conflictDiff(category: Category, name: string, sub: string | null | undefined, file: string): Promise<string> {
    return invoke<string>('conflict_diff', { category, name, sub: sub ?? null, file });
  },
  conflictResolveOurs(category: Category, name: string, sub: string | null | undefined, file: string): Promise<ActionResult> {
    return invoke<ActionResult>('conflict_resolve_ours', { category, name, sub: sub ?? null, file });
  },
  conflictResolveTheirs(category: Category, name: string, sub: string | null | undefined, file: string): Promise<ActionResult> {
    return invoke<ActionResult>('conflict_resolve_theirs', { category, name, sub: sub ?? null, file });
  },
  conflictAbort(category: Category, name: string, sub?: string | null): Promise<ActionResult> {
    return invoke<ActionResult>('conflict_abort', { category, name, sub: sub ?? null });
  },
  conflictContinue(category: Category, name: string, sub?: string | null): Promise<ActionResult> {
    return invoke<ActionResult>('conflict_continue', { category, name, sub: sub ?? null });
  },

  // --- PRs ---
  prDetail(category: Category, name: string, sub: string | null | undefined, number: number): Promise<PrDetail> {
    return invoke<PrDetail>('pr_detail', { category, name, sub: sub ?? null, number });
  },
  prCreate(
    category: Category, name: string, sub: string | null | undefined,
    head: string, base: string, title: string, body?: string, draft = false,
  ): Promise<PrDetail> {
    return invoke<PrDetail>('pr_create', {
      category, name, sub: sub ?? null,
      head, base, title, body: body ?? null, draft,
    });
  },
  prMerge(
    category: Category, name: string, sub: string | null | undefined,
    number: number, method: MergeMethod = 'squash',
  ): Promise<string> {
    return invoke<string>('pr_merge', { category, name, sub: sub ?? null, number, method });
  },
  prEnableAutoMerge(
    category: Category, name: string, sub: string | null | undefined,
    number: number, method: MergeMethod = 'squash',
  ): Promise<string> {
    return invoke<string>('pr_enable_auto_merge', { category, name, sub: sub ?? null, number, method });
  },
  prDisableAutoMerge(
    category: Category, name: string, sub: string | null | undefined,
    number: number,
  ): Promise<string> {
    return invoke<string>('pr_disable_auto_merge', { category, name, sub: sub ?? null, number });
  },
};

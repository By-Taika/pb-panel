import { invoke } from '@tauri-apps/api/core';
import type {
  AccountsInfo,
  Category,
  Commit,
  Config,
  OpenPr,
  RepoInfo,
  RepoMeta,
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
};

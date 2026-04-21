// Categories are now fully dynamic — the string is whatever the user named
// their folder under baseDir, and comes from config.categories[].name.
export type Category = string;

// Account id, also dynamic — matches config.accounts[].id.
export type Account = string;

export interface AccountConfig {
  id: string;
  label: string;
  username?: string | null;
  /** Optional env var to fall back to when the keychain entry is missing. */
  envVar?: string | null;
}

export interface CategoryConfig {
  name: string;
  accountId: string;
  nested: boolean;
  hide: string[];
}

export interface Config {
  version: number;
  baseDir: string;
  accounts: AccountConfig[];
  categories: CategoryConfig[];
  firstRunComplete: boolean;
}

export interface RepoInfo {
  id: string;
  category: Category;
  subCategory: string | null;
  name: string;
  path: string;
  account: Account;
  branch: string | null;
  dirty: number;
  ahead: number;
  behind: number;
  lastCommit: {
    hash: string;
    short: string;
    subject: string;
    author: string;
    relativeTime: string;
    timestamp: number;
  } | null;
  remote: string | null;
  owner: string | null;
  repoName: string | null;
  hasUpstream: boolean;
  /** Null means the remote-update check couldn't run (offline, auth, no
   *  remote). Zero means everything is in sync; >0 is the count of branches
   *  that have new commits on the remote since the last local fetch. */
  remoteUpdates: number | null;
  updatedBranches: string[];
}

export interface AccountCard {
  login: string;
  name: string;
  avatar: string;
}

/** Keyed by account id — same keys as Config.accounts[].id. */
export type AccountsInfo = Record<string, AccountCard | null>;

export interface RepoMeta {
  private: boolean;
  defaultBranch: string;
  stars: number;
  openIssues: number;
  description: string | null;
  pushedAt: string;
  language: string | null;
}

export interface OpenPr {
  number: number;
  title: string;
  draft: boolean;
  author: string;
  url: string;
  updated: string;
}

export interface Commit {
  hash: string;
  short: string;
  subject: string;
  author: string;
  relativeTime: string;
  timestamp: number;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  lastCommitSubject: string | null;
  lastCommitRelative: string | null;
}

export interface StashEntry {
  index: number;
  message: string;
  relativeTime: string;
}

export interface ConflictFile {
  path: string;
  statusCode: string;
}

export interface ConflictState {
  inMerge: boolean;
  inRebase: boolean;
  files: ConflictFile[];
}

export interface PrDetail {
  number: number;
  title: string;
  body: string | null;
  draft: boolean;
  url: string;
  mergeable: boolean | null;
  mergeableState: string | null;
  autoMergeEnabled: boolean;
  headRef: string;
  baseRef: string;
  author: string;
  updated: string;
}

export type MergeMethod = 'merge' | 'squash' | 'rebase';

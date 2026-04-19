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

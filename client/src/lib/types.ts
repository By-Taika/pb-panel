export type Category = 'Rani' | 'CodeCrew' | 'KRN' | 'Fordevo' | 'ByTaika';
export const CATEGORIES: Category[] = ['Rani', 'CodeCrew', 'KRN', 'Fordevo', 'ByTaika'];

export type Account = 'rani' | 'personal';

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

export interface AccountsInfo {
  rani: { login: string; name: string; avatar: string } | null;
  personal: { login: string; name: string; avatar: string } | null;
}

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

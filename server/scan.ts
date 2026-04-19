import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileP = promisify(execFile);

export const CATEGORIES = ['Rani', 'CodeCrew', 'KRN', 'Fordevo', 'ByTaika'] as const;
export type Category = typeof CATEGORIES[number];

export const BASE = path.join(os.homedir(), 'ProjectBase');

const ACCOUNT_MAP: Record<Category, 'rani' | 'personal'> = {
  Rani: 'rani',
  CodeCrew: 'personal',
  KRN: 'personal',
  Fordevo: 'personal',
  ByTaika: 'personal',
};

export interface RepoInfo {
  id: string;                    // category/[sub/]name — stable key for UI
  category: Category;
  subCategory: string | null;    // e.g. "Mobil Uygulama" (null = directly under category)
  name: string;
  path: string;
  account: 'rani' | 'personal';
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

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileP('git', ['-C', cwd, ...args], { maxBuffer: 4 * 1024 * 1024 });
    return stdout.trimEnd();
  } catch {
    return '';
  }
}

function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[:/]{1}([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

async function isGitRepo(p: string): Promise<boolean> {
  const st = await stat(path.join(p, '.git')).catch(() => null);
  return !!st;
}

export function repoPathFor(category: Category, subCategory: string | null, name: string): string {
  return subCategory ? path.join(BASE, category, subCategory, name) : path.join(BASE, category, name);
}

export async function listCategoryRepos(category: Category): Promise<RepoInfo[]> {
  const catDir = path.join(BASE, category);
  let entries: string[] = [];
  try {
    entries = await readdir(catDir);
  } catch {
    return [];
  }

  const infos: RepoInfo[] = [];
  for (const entryName of entries) {
    if (entryName.startsWith('.')) continue;
    const entryPath = path.join(catDir, entryName);
    const st = await stat(entryPath).catch(() => null);
    if (!st?.isDirectory()) continue;

    // Case 1: entry is itself a repo (flat: Category/repo)
    if (await isGitRepo(entryPath)) {
      infos.push(await getRepoInfo(category, null, entryName, entryPath));
      continue;
    }

    // Case 2: entry is a sub-category folder; walk one level deeper
    let subEntries: string[] = [];
    try {
      subEntries = await readdir(entryPath);
    } catch {
      continue;
    }
    for (const subName of subEntries) {
      if (subName.startsWith('.')) continue;
      const subPath = path.join(entryPath, subName);
      const subSt = await stat(subPath).catch(() => null);
      if (!subSt?.isDirectory()) continue;
      if (await isGitRepo(subPath)) {
        infos.push(await getRepoInfo(category, entryName, subName, subPath));
      }
    }
  }

  infos.sort((a, b) => {
    const s = (a.subCategory || '').localeCompare(b.subCategory || '');
    if (s !== 0) return s;
    return a.name.localeCompare(b.name);
  });
  return infos;
}

export async function getRepoInfo(
  category: Category,
  subCategory: string | null,
  name: string,
  repoPath: string
): Promise<RepoInfo> {
  const [branch, statusPorcelain, aheadBehind, lastCommitRaw, remote] = await Promise.all([
    git(repoPath, ['branch', '--show-current']),
    git(repoPath, ['status', '--porcelain']),
    git(repoPath, ['rev-list', '--left-right', '--count', '@{u}...HEAD']),
    git(repoPath, ['log', '-1', '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%cr%x1f%ct']),
    git(repoPath, ['config', '--get', 'remote.origin.url']),
  ]);

  const dirty = statusPorcelain ? statusPorcelain.split('\n').filter(Boolean).length : 0;
  let ahead = 0;
  let behind = 0;
  let hasUpstream = false;
  if (aheadBehind) {
    const m = aheadBehind.match(/^(\d+)\s+(\d+)$/);
    if (m) {
      behind = parseInt(m[1], 10);
      ahead = parseInt(m[2], 10);
      hasUpstream = true;
    }
  }

  let lastCommit: RepoInfo['lastCommit'] = null;
  if (lastCommitRaw) {
    const parts = lastCommitRaw.split('\x1f');
    if (parts.length >= 6) {
      lastCommit = {
        hash: parts[0],
        short: parts[1],
        subject: parts[2],
        author: parts[3],
        relativeTime: parts[4],
        timestamp: parseInt(parts[5], 10),
      };
    }
  }

  const gh = remote ? parseGithubRemote(remote) : null;
  const id = subCategory ? `${category}/${subCategory}/${name}` : `${category}/${name}`;

  return {
    id,
    category,
    subCategory,
    name,
    path: repoPath,
    account: ACCOUNT_MAP[category],
    branch: branch || null,
    dirty,
    ahead,
    behind,
    lastCommit,
    remote: remote || null,
    owner: gh?.owner ?? null,
    repoName: gh?.repo ?? null,
    hasUpstream,
  };
}

export async function listAllRepos(): Promise<Record<Category, RepoInfo[]>> {
  const result: Partial<Record<Category, RepoInfo[]>> = {};
  await Promise.all(
    CATEGORIES.map(async (cat) => {
      result[cat] = await listCategoryRepos(cat);
    })
  );
  return result as Record<Category, RepoInfo[]>;
}

export function accountFor(category: Category): 'rani' | 'personal' {
  return ACCOUNT_MAP[category];
}

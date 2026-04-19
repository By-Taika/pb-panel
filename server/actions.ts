import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { BASE, type Category, CATEGORIES, accountFor } from './scan.ts';

const execFileP = promisify(execFile);

function buildAuthUrl(owner: string, repo: string, account: 'rani' | 'personal'): string {
  const user = account === 'rani' ? 'serhat-kiran' : 'By-Taika';
  const token = account === 'rani' ? process.env.GH_TOKEN_RANI : process.env.GH_TOKEN_PERSONAL;
  if (!token) throw new Error(`Missing token for ${account}. Ensure ~/.config/gh-tokens/${account}.env is sourced.`);
  return `https://${user}:${token}@github.com/${owner}/${repo}.git`;
}

function cleanUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

export async function pullRepo(repoPath: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileP('git', ['-C', repoPath, 'pull', '--ff-only'], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, output: (stdout + stderr).trim() };
  } catch (e: any) {
    return { ok: false, output: (e.stdout || '') + (e.stderr || e.message) };
  }
}

export async function fetchRepo(repoPath: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileP('git', ['-C', repoPath, 'fetch', '--all', '--prune'], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, output: (stdout + stderr).trim() };
  } catch (e: any) {
    return { ok: false, output: (e.stdout || '') + (e.stderr || e.message) };
  }
}

export async function cloneRepo(params: {
  category: Category;
  subCategory?: string;
  ownerRepo: string;
  targetName?: string;
}): Promise<{ ok: boolean; output: string; path?: string }> {
  if (!CATEGORIES.includes(params.category)) {
    return { ok: false, output: `Invalid category: ${params.category}` };
  }

  let or = params.ownerRepo.trim();
  or = or.replace(/^git@github\.com:/, '');
  or = or.replace(/^https:\/\/github\.com\//, '');
  or = or.replace(/\.git$/, '');
  const parts = or.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, output: `Cannot parse repo: ${params.ownerRepo}` };
  }
  const [owner, repo] = parts;

  const account = accountFor(params.category);
  let authUrl: string;
  try {
    authUrl = buildAuthUrl(owner, repo, account);
  } catch (e: any) {
    return { ok: false, output: e.message };
  }

  const sub = params.subCategory?.trim();
  const parentDir = sub ? path.join(BASE, params.category, sub) : path.join(BASE, params.category);
  await mkdir(parentDir, { recursive: true });

  const targetName = params.targetName?.trim() || repo;
  const clonePath = path.join(parentDir, targetName);

  try {
    const { stdout, stderr } = await execFileP('git', ['clone', authUrl, clonePath], {
      maxBuffer: 32 * 1024 * 1024,
    });
    await execFileP('git', ['-C', clonePath, 'remote', 'set-url', 'origin', cleanUrl(owner, repo)]);
    return { ok: true, output: (stdout + stderr).trim(), path: clonePath };
  } catch (e: any) {
    const output = (e.stdout || '') + (e.stderr || e.message);
    return { ok: false, output: output.replace(/ghp_[A-Za-z0-9]+/g, 'ghp_***') };
  }
}

export async function openInIde(repoPath: string, ideOverride?: string): Promise<{ ok: boolean; output: string }> {
  const ide = ideOverride || (await detectIde(repoPath));
  try {
    if (ide === 'finder') {
      await execFileP('open', [repoPath]);
      return { ok: true, output: `opened in Finder` };
    }
    await execFileP(ide, [repoPath]);
    return { ok: true, output: `opened in ${ide}` };
  } catch {
    try {
      await execFileP('open', [repoPath]);
      return { ok: true, output: `fallback: opened in Finder (${ide} not found)` };
    } catch (e2: any) {
      return { ok: false, output: e2.message };
    }
  }
}

async function detectIde(repoPath: string): Promise<string> {
  let files: string[] = [];
  try {
    files = await readdir(repoPath);
  } catch {
    return 'open';
  }
  const has = (name: string) => files.includes(name);
  const hasAny = (names: string[]) => names.some((n) => files.includes(n));

  if (hasAny(['pubspec.yaml'])) return 'studio';
  if (files.some((f) => f.endsWith('.sln') || f.endsWith('.csproj'))) return 'rider';
  if (has('composer.json') || has('artisan')) return 'phpstorm';
  if (has('package.json') && !hasAny(['pubspec.yaml'])) return 'webstorm';
  if (has('pyproject.toml') || has('requirements.txt') || has('setup.py')) return 'pycharm';
  if (has('go.mod')) return 'goland';
  return 'idea';
}

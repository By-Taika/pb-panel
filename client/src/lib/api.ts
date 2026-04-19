import type { Category, RepoInfo, AccountsInfo, RepoMeta, OpenPr } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

function subQuery(sub?: string | null): string {
  return sub ? `?sub=${encodeURIComponent(sub)}` : '';
}

export const api = {
  async accounts(): Promise<AccountsInfo> {
    return json(await fetch('/api/accounts'));
  },
  async repos(): Promise<Record<Category, RepoInfo[]>> {
    return json(await fetch('/api/repos'));
  },
  async repoMeta(category: Category, name: string, sub?: string | null): Promise<RepoMeta | null> {
    return json(await fetch(`/api/repo/${category}/${encodeURIComponent(name)}/meta${subQuery(sub)}`));
  },
  async repoPrs(category: Category, name: string, sub?: string | null): Promise<OpenPr[]> {
    return json(await fetch(`/api/repo/${category}/${encodeURIComponent(name)}/prs${subQuery(sub)}`));
  },
  async pull(category: Category, name: string, sub?: string | null) {
    return json<{ ok: boolean; output: string }>(
      await fetch(`/api/repo/${category}/${encodeURIComponent(name)}/pull${subQuery(sub)}`, { method: 'POST' })
    );
  },
  async fetchRemote(category: Category, name: string, sub?: string | null) {
    return json<{ ok: boolean; output: string }>(
      await fetch(`/api/repo/${category}/${encodeURIComponent(name)}/fetch${subQuery(sub)}`, { method: 'POST' })
    );
  },
  async openIde(category: Category, name: string, sub?: string | null, ide?: string) {
    return json<{ ok: boolean; output: string }>(
      await fetch(`/api/repo/${category}/${encodeURIComponent(name)}/open${subQuery(sub)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ide }),
      })
    );
  },
  async clone(category: Category, ownerRepo: string, targetName?: string, subCategory?: string) {
    const res = await fetch('/api/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subCategory, ownerRepo, targetName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ output: res.statusText }));
      throw new Error(err.output || 'clone failed');
    }
    return res.json() as Promise<{ ok: boolean; output: string; path?: string }>;
  },
};

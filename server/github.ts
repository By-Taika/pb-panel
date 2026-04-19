/**
 * Minimal GitHub API client using per-account tokens.
 * Uses fetch directly to avoid extra deps.
 */

interface GhPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  user: { login: string };
  html_url: string;
  updated_at: string;
}

function tokenFor(account: 'rani' | 'personal'): string | undefined {
  return account === 'rani' ? process.env.GH_TOKEN_RANI : process.env.GH_TOKEN_PERSONAL;
}

async function ghFetch<T>(path: string, account: 'rani' | 'personal'): Promise<T | null> {
  const token = tokenFor(account);
  if (!token) return null;
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pb-panel',
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function fetchOpenPrs(owner: string, repo: string, account: 'rani' | 'personal') {
  const prs = await ghFetch<GhPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=10`, account);
  if (!prs) return [];
  return prs.map((p) => ({
    number: p.number,
    title: p.title,
    draft: p.draft,
    author: p.user.login,
    url: p.html_url,
    updated: p.updated_at,
  }));
}

export async function fetchRepoMeta(owner: string, repo: string, account: 'rani' | 'personal') {
  const meta = await ghFetch<any>(`/repos/${owner}/${repo}`, account);
  if (!meta) return null;
  return {
    private: meta.private,
    defaultBranch: meta.default_branch,
    stars: meta.stargazers_count,
    openIssues: meta.open_issues_count,
    description: meta.description,
    pushedAt: meta.pushed_at,
    language: meta.language,
  };
}

export async function fetchUser(account: 'rani' | 'personal') {
  return ghFetch<{ login: string; name: string; avatar_url: string }>('/user', account);
}

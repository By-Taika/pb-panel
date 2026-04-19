import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import {
  listAllRepos,
  getRepoInfo,
  CATEGORIES,
  BASE,
  repoPathFor,
  type Category,
} from './scan.ts';
import { pullRepo, fetchRepo, cloneRepo, openInIde } from './actions.ts';
import { fetchOpenPrs, fetchRepoMeta, fetchUser } from './github.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTokenFiles() {
  const dir = path.join(os.homedir(), '.config', 'gh-tokens');
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.env')) continue;
    const raw = readFileSync(path.join(dir, file), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*export\s+([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m) process.env[m[1]] ??= m[2];
    }
  }
}
loadTokenFiles();

const PORT = parseInt(process.env.PB_PANEL_PORT || '5556', 10);
const HOST = '127.0.0.1';

const app = Fastify({ logger: { transport: { target: 'pino-pretty' } } as any });

function subFrom(q: unknown): string | null {
  const v = (q as any)?.sub;
  if (typeof v !== 'string' || !v.trim()) return null;
  return v;
}

function assertCategory(c: string): Category {
  if (!CATEGORIES.includes(c as Category)) {
    throw Object.assign(new Error(`invalid category: ${c}`), { statusCode: 400 });
  }
  return c as Category;
}

app.get('/api/health', async () => ({ ok: true, base: BASE, categories: CATEGORIES }));

app.get('/api/accounts', async () => {
  const [rani, personal] = await Promise.all([fetchUser('rani'), fetchUser('personal')]);
  return {
    rani: rani ? { login: rani.login, name: rani.name, avatar: rani.avatar_url } : null,
    personal: personal ? { login: personal.login, name: personal.name, avatar: personal.avatar_url } : null,
  };
});

app.get('/api/repos', async () => {
  return await listAllRepos();
});

app.get<{ Params: { category: string; name: string } }>(
  '/api/repo/:category/:name',
  async (req, reply) => {
    try {
      const cat = assertCategory(req.params.category);
      const sub = subFrom(req.query);
      const info = await getRepoInfo(cat, sub, req.params.name, repoPathFor(cat, sub, req.params.name));
      if (!info.branch && !info.lastCommit) return reply.code(404).send({ error: 'not a git repo' });
      return info;
    } catch (e: any) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  }
);

app.get<{ Params: { category: string; name: string } }>(
  '/api/repo/:category/:name/prs',
  async (req, reply) => {
    try {
      const cat = assertCategory(req.params.category);
      const sub = subFrom(req.query);
      const info = await getRepoInfo(cat, sub, req.params.name, repoPathFor(cat, sub, req.params.name));
      if (!info.owner || !info.repoName) return [];
      return await fetchOpenPrs(info.owner, info.repoName, info.account);
    } catch (e: any) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  }
);

app.get<{ Params: { category: string; name: string } }>(
  '/api/repo/:category/:name/meta',
  async (req, reply) => {
    try {
      const cat = assertCategory(req.params.category);
      const sub = subFrom(req.query);
      const info = await getRepoInfo(cat, sub, req.params.name, repoPathFor(cat, sub, req.params.name));
      if (!info.owner || !info.repoName) return null;
      return await fetchRepoMeta(info.owner, info.repoName, info.account);
    } catch (e: any) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  }
);

app.post<{ Params: { category: string; name: string } }>(
  '/api/repo/:category/:name/pull',
  async (req, reply) => {
    try {
      const cat = assertCategory(req.params.category);
      const sub = subFrom(req.query);
      return await pullRepo(repoPathFor(cat, sub, req.params.name));
    } catch (e: any) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  }
);

app.post<{ Params: { category: string; name: string } }>(
  '/api/repo/:category/:name/fetch',
  async (req, reply) => {
    try {
      const cat = assertCategory(req.params.category);
      const sub = subFrom(req.query);
      return await fetchRepo(repoPathFor(cat, sub, req.params.name));
    } catch (e: any) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  }
);

app.post<{ Params: { category: string; name: string }; Body: { ide?: string } }>(
  '/api/repo/:category/:name/open',
  async (req, reply) => {
    try {
      const cat = assertCategory(req.params.category);
      const sub = subFrom(req.query);
      return await openInIde(repoPathFor(cat, sub, req.params.name), req.body?.ide);
    } catch (e: any) {
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  }
);

app.post<{
  Body: { category: Category; subCategory?: string; ownerRepo: string; targetName?: string };
}>('/api/clone', async (req, reply) => {
  const { category, subCategory, ownerRepo, targetName } = req.body || ({} as any);
  if (!category || !ownerRepo) return reply.code(400).send({ error: 'category and ownerRepo required' });
  const result = await cloneRepo({ category, subCategory, ownerRepo, targetName });
  if (!result.ok) return reply.code(500).send(result);
  return result;
});

if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(__dirname, '../dist/client');
  if (existsSync(clientDir)) {
    app.register(fastifyStatic, { root: clientDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
  }
}

app.listen({ port: PORT, host: HOST }).then((addr) => {
  app.log.info(`pb-panel server listening at ${addr}`);
});

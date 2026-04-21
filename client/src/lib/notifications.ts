import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { RepoInfo } from './types';

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

let cached: boolean | null = null;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    cached = granted;
    return granted;
  } catch {
    cached = false;
    return false;
  }
}

export async function notify(title: string, body: string): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  try {
    sendNotification({ title, body });
  } catch {
    /* swallow */
  }
}

/**
 * Compare a fresh repos map against the previous snapshot and emit notifications
 * for meaningful changes. First run (prev null) emits nothing so a cold start
 * stays quiet. The translator is injected from the caller so notifications match
 * the user's current UI language.
 */
export function diffAndNotify(
  prev: Record<string, RepoInfo[]> | null,
  next: Record<string, RepoInfo[]>,
  t: Translator,
) {
  if (!prev) return;

  const flatten = (m: Record<string, RepoInfo[]>) => Object.values(m).flat();
  const prevMap = new Map(flatten(prev).map((r) => [r.id, r]));

  for (const cur of flatten(next)) {
    const old = prevMap.get(cur.id);
    if (!old) continue;

    if ((old.behind || 0) === 0 && (cur.behind || 0) > 0) {
      notify(
        t('notif.newCommit.title'),
        t('notif.newCommit.body', { name: cur.name, n: cur.behind }),
      );
    }
    if ((old.dirty || 0) === 0 && (cur.dirty || 0) > 0) {
      notify(
        t('notif.dirty.title'),
        t('notif.dirty.body', { name: cur.name, n: cur.dirty }),
      );
    }
    const oldRemote = old.remoteUpdates ?? 0;
    const newRemote = cur.remoteUpdates ?? 0;
    if (oldRemote === 0 && newRemote > 0) {
      notify(
        t('notif.remote.title'),
        t('notif.remote.body', { name: cur.name, branches: cur.updatedBranches.join(', ') }),
      );
    }
  }
}

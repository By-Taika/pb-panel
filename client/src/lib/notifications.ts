import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { RepoInfo } from './types';

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
 * for things the user asked us to watch for — new behind commits and fresh dirty
 * files. First run (prev null) emits nothing so a cold start stays quiet.
 */
export function diffAndNotify(
  prev: Record<string, RepoInfo[]> | null,
  next: Record<string, RepoInfo[]>,
) {
  if (!prev) return;

  const flatten = (m: Record<string, RepoInfo[]>) => Object.values(m).flat();
  const prevMap = new Map(flatten(prev).map((r) => [r.id, r]));

  for (const cur of flatten(next)) {
    const old = prevMap.get(cur.id);
    if (!old) continue;

    // New remote commits surfaced on a previously synced repo.
    if ((old.behind || 0) === 0 && (cur.behind || 0) > 0) {
      notify(
        'Yeni commit var',
        `${cur.name} ${cur.behind} commit geride. Pull etmek ister misin?`,
      );
    }
    // A repo that was clean is now dirty — helpful before shutdown.
    if ((old.dirty || 0) === 0 && (cur.dirty || 0) > 0) {
      notify(
        'Uncommitted değişiklik',
        `${cur.name} içinde ${cur.dirty} dosya değişmiş, henüz commit edilmemiş.`,
      );
    }
    // Remote has updates that haven't been fetched yet.
    const oldRemote = old.remoteUpdates ?? 0;
    const newRemote = cur.remoteUpdates ?? 0;
    if (oldRemote === 0 && newRemote > 0) {
      notify(
        'Remote güncellendi',
        `${cur.name} için upstream'de yeni iş var (${cur.updatedBranches.join(', ')}).`,
      );
    }
  }
}

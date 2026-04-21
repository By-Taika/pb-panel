import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateCheckResult =
  | { kind: 'none' }
  | { kind: 'available'; update: Update }
  | { kind: 'error'; message: string };

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (update) {
      return { kind: 'available', update };
    }
    return { kind: 'none' };
  } catch (e: any) {
    return { kind: 'error', message: e?.message || String(e) };
  }
}

export async function installUpdate(update: Update, onProgress?: (downloaded: number, total: number | null) => void): Promise<void> {
  let total: number | null = null;
  let downloaded = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = typeof event.data.contentLength === 'number' ? event.data.contentLength : null;
        onProgress?.(0, total);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, total);
        break;
      case 'Finished':
        onProgress?.(total ?? downloaded, total);
        break;
    }
  });
  await relaunch();
}

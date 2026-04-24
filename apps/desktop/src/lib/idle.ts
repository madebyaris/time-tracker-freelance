import { invoke } from '@tauri-apps/api/core';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { useTimer } from '../state/timer';
import { Settings, TimeEntries } from '../db/repos';

const DEFAULT_THRESHOLD_SECS = 5 * 60; // 5 minutes
const POLL_INTERVAL_MS = 30_000;
let pollTimer: number | null = null;
let lastPromptedFor: string | null = null;

/**
 * Polls the OS idle counter every 30s. When idle exceeds the threshold
 * AND a timer is running, prompt the user to keep / discard the idle time.
 *
 * The threshold is configurable via `Settings.set('idle_threshold_secs', ...)`.
 */
export function startIdleWatcher() {
  if (pollTimer !== null) return;
  // request notification permission once
  void (async () => {
    if (!(await isPermissionGranted())) {
      try {
        await requestPermission();
      } catch {
        /* user denied */
      }
    }
  })();

  pollTimer = window.setInterval(async () => {
    try {
      const idle = (await invoke<number>('idle_seconds')) ?? 0;
      const running = useTimer.getState().running;
      if (!running) return;

      const stored = (await Settings.get('idle_threshold_secs')) ?? String(DEFAULT_THRESHOLD_SECS);
      const threshold = Number(stored);
      if (idle < threshold) {
        lastPromptedFor = null;
        return;
      }
      // Only prompt once per idle session per running entry
      if (lastPromptedFor === running.id) return;
      lastPromptedFor = running.id;

      const minutes = Math.floor(idle / 60);
      try {
        await sendNotification({
          title: 'You went idle',
          body: `Idle for ${minutes} minutes. Open Tickr to keep or discard the time.`,
        });
      } catch {
        /* permission missing */
      }

      // For now we just silently subtract the idle window from the running entry
      // when the user comes back. A future iteration can prompt.
      await TimeEntries.update(running.id, {
        idle_discarded_seconds: (running.idle_discarded_seconds ?? 0) + idle,
      });
    } catch (err) {
      console.warn('idle watcher error', err);
    }
  }, POLL_INTERVAL_MS);
}

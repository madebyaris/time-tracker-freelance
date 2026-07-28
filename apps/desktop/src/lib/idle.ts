import { invoke } from '@tauri-apps/api/core';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { useTimer } from '../state/timer';
import { Settings, TimeEntries } from '../db/repos';

const DEFAULT_THRESHOLD_SECS = 5 * 60; // 5 minutes
const POLL_INTERVAL_MS = 30_000;

/** Settings key. `'0'` disables; anything else (or missing) enables. Default: on. */
export const IDLE_DETECTION_ENABLED_KEY = 'idle_detection_enabled';

let pollTimer: number | null = null;
let lastPromptedFor: string | null = null;

/**
 * Polls the OS idle counter every 30s. When idle exceeds the threshold
 * AND a timer is running, notifies and discards the idle window from the
 * running entry.
 *
 * Enable/disable via `Settings.set('idle_detection_enabled', '1' | '0')`.
 * Threshold via `Settings.set('idle_threshold_secs', ...)`.
 */
export function startIdleWatcher() {
  if (pollTimer !== null) return;
  void (async () => {
    if (!(await isPermissionGranted())) {
      try {
        await requestPermission();
      } catch {
        /* user denied */
      }
    }
  })();

  pollTimer = window.setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
}

async function isIdleDetectionEnabled(): Promise<boolean> {
  // Default on: existing installs keep the previous behaviour until they opt out.
  const stored = await Settings.get(IDLE_DETECTION_ENABLED_KEY);
  return stored !== '0';
}

async function tick() {
  try {
    if (!(await isIdleDetectionEnabled())) {
      lastPromptedFor = null;
      return;
    }

    const idle = (await invoke<number>('idle_seconds')) ?? 0;
    const running = useTimer.getState().running;
    if (!running) return;

    const stored = (await Settings.get('idle_threshold_secs')) ?? String(DEFAULT_THRESHOLD_SECS);
    const threshold = Number(stored);
    if (!Number.isFinite(threshold) || threshold <= 0 || idle < threshold) {
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

    // Silently subtract the idle window from the running entry for now.
    // A future iteration can prompt keep / discard.
    await TimeEntries.update(running.id, {
      idle_discarded_seconds: (running.idle_discarded_seconds ?? 0) + idle,
    });
  } catch (err) {
    console.warn('idle watcher error', err);
  }
}

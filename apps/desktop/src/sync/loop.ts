import { Settings } from '../db/repos';
import { runSync } from './engine';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
let started = false;

/**
 * Drives the sync loop:
 *  - on startup if a backend is configured
 *  - every 5 minutes
 *  - on window focus
 *
 * Sync is a no-op when no backend URL is configured (offline-first mode).
 */
export function startSyncLoop() {
  if (started) return;
  started = true;
  void tickIfConfigured();
  setInterval(tickIfConfigured, SYNC_INTERVAL_MS);
  window.addEventListener('focus', () => void tickIfConfigured());
}

async function tickIfConfigured() {
  const url = await Settings.get('backend_url');
  if (!url) return;
  try {
    await runSync();
  } catch (err) {
    console.warn('[sync] failed', err);
  }
}

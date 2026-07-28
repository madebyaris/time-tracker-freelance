import { invoke } from '@tauri-apps/api/core';
import { useTimer } from '../state/timer';

export const TIMER_ACTION_PENDING = 'deep-link://timer-action-pending';

async function runPendingTimerActions() {
  const actions = await invoke<string[]>('take_pending_timer_actions');
  for (const action of actions) {
    if (action === 'pause') await useTimer.getState().pause();
    if (action === 'resume') await useTimer.getState().resume();
  }
}

let timerActionChain = Promise.resolve();

export function schedulePendingTimerActions() {
  // Serialize rapid clicks. A Resume arriving while Pause is still writing to
  // SQLite must run afterwards, not inspect the stale pre-pause store state.
  timerActionChain = timerActionChain
    .then(runPendingTimerActions)
    .catch((error) => console.warn('deep-link timer action failed', error));
  return timerActionChain;
}

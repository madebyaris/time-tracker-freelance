import { create } from 'zustand';
import { emit, listen } from '@tauri-apps/api/event';
import { TimeEntries, type TimeEntry } from '../db/repos';
import { queryClient } from '../lib/query-client';

interface StartInput {
  project_id?: string | null;
  client_id?: string | null;
  description?: string | null;
  source?: 'manual' | 'timer' | 'pomodoro' | 'calendar';
}

interface TimerState {
  running: TimeEntry | null;
  /** Re-render trigger every second while running. */
  tick: number;
  init: () => Promise<void>;
  start: (input: StartInput) => Promise<void>;
  stop: () => Promise<void>;
  toggle: (input?: StartInput) => Promise<void>;
  setRunning: (entry: TimeEntry | null) => void;
}

/**
 * Cross-window event so main + tray-panel windows stay in sync without
 * each one polling SQLite.
 */
const TIMER_CHANGED = 'timer://changed';

export const useTimer = create<TimerState>((set, get) => ({
  running: null,
  tick: 0,
  init: async () => {
    const running = await TimeEntries.getRunning();
    set({ running });
  },
  start: async (input) => {
    const running = await TimeEntries.start({
      project_id: input.project_id ?? null,
      client_id: input.client_id ?? null,
      description: input.description ?? null,
      source: input.source ?? 'timer',
    });
    set({ running });
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    void emit(TIMER_CHANGED);
  },
  stop: async () => {
    const r = get().running;
    if (!r) return;
    await TimeEntries.stop(r.id);
    set({ running: null });
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    void emit(TIMER_CHANGED);
  },
  toggle: async (input) => {
    if (get().running) await get().stop();
    else await get().start(input ?? {});
  },
  setRunning: (entry) => set({ running: entry }),
}));

// Single global ticker — bumps `tick` once a second so consumers re-render.
let _started = false;
export function startTicker() {
  if (_started) return;
  _started = true;
  setInterval(() => {
    if (useTimer.getState().running) {
      useTimer.setState((s) => ({ tick: s.tick + 1 }));
    }
  }, 1000);

  // Cross-window sync: when another window changes the timer, re-read it.
  void listen(TIMER_CHANGED, () => {
    void useTimer.getState().init();
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
  });
}

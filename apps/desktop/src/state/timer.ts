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
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  toggle: (input?: StartInput) => Promise<void>;
  setRunning: (entry: TimeEntry | null) => void;
}

/**
 * Cross-window event so main + tray-panel windows stay in sync without
 * each one polling SQLite. Payload is consumed both by JS subscribers
 * (which just re-read the running entry) and by the Rust tray module
 * (which uses `kind` + `started_at` to drive the menubar live timer).
 *
 * For the menubar ticker we always send the *effective* started_at —
 * i.e. start moved forward by `paused_seconds` — so the Rust side can
 * just count seconds since that timestamp without knowing about pauses.
 */
const TIMER_CHANGED = 'timer://changed';

export type TimerChangedPayload =
  | { kind: 'start'; started_at: number; description: string | null }
  | { kind: 'pause'; elapsed_seconds: number }
  | { kind: 'resume'; started_at: number }
  | { kind: 'stop' };

function effectiveStartedAt(entry: TimeEntry): number {
  return entry.started_at + entry.paused_seconds * 1000;
}

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
    void emit(TIMER_CHANGED, {
      kind: 'start',
      started_at: effectiveStartedAt(running),
      description: running.description,
    } satisfies TimerChangedPayload);
  },
  stop: async () => {
    const r = get().running;
    if (!r) return;
    await TimeEntries.stop(r.id);
    set({ running: null });
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    void emit(TIMER_CHANGED, { kind: 'stop' } satisfies TimerChangedPayload);
  },
  pause: async () => {
    const r = get().running;
    if (!r || r.paused_at != null) return;
    await TimeEntries.pause(r.id);
    const fresh = await TimeEntries.get(r.id);
    if (fresh) set({ running: fresh });
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    const now = Date.now();
    const elapsed = Math.max(
      0,
      Math.floor((now - r.started_at) / 1000) - r.paused_seconds,
    );
    void emit(TIMER_CHANGED, {
      kind: 'pause',
      elapsed_seconds: elapsed,
    } satisfies TimerChangedPayload);
  },
  resume: async () => {
    const r = get().running;
    if (!r || r.paused_at == null) return;
    await TimeEntries.resume(r.id);
    const fresh = await TimeEntries.get(r.id);
    if (fresh) set({ running: fresh });
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    if (fresh) {
      void emit(TIMER_CHANGED, {
        kind: 'resume',
        started_at: effectiveStartedAt(fresh),
      } satisfies TimerChangedPayload);
    }
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

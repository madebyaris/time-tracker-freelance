import { create } from 'zustand';
import { sendNotification, isPermissionGranted } from '@tauri-apps/plugin-notification';
import { useTimer } from './timer';
import { TimeEntries } from '../db/repos';

const WORK = 25 * 60;
const SHORT = 5 * 60;

type Phase = 'idle' | 'work' | 'break';

interface PomodoroState {
  enabled: boolean;
  /** When the current phase started (ms), or 0. */
  phaseStart: number;
  phase: Phase;
  setEnabled: (v: boolean) => void;
  startSession: () => void;
  tick: number;
  /** Called every second from App when pomodoro is on. */
  onSecond: () => Promise<void>;
  reset: () => void;
}

let tickTimer: number | null = null;

export const usePomodoro = create<PomodoroState>((set, get) => ({
  enabled: false,
  phaseStart: 0,
  phase: 'idle',
  tick: 0,
  setEnabled: (v) => {
    set({ enabled: v });
    if (v) {
      if (tickTimer == null) {
        tickTimer = window.setInterval(() => {
          if (get().enabled) {
            void get().onSecond();
            set((s) => ({ tick: s.tick + 1 }));
          }
        }, 1000);
      }
    } else {
      if (tickTimer != null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      get().reset();
    }
  },
  startSession: () => {
    set({ phase: 'work', phaseStart: Date.now() });
  },
  reset: () => {
    set({ phase: 'idle', phaseStart: 0, tick: 0 });
  },
  onSecond: async () => {
    const s = get();
    if (s.phase === 'idle' || !s.phaseStart) return;
    const elapsed = Math.floor((Date.now() - s.phaseStart) / 1000);
    if (s.phase === 'work' && elapsed >= WORK) {
      try {
        const running = useTimer.getState().running;
        if (running) {
          await TimeEntries.stop(running.id);
        }
        useTimer.setState({ running: null });
        if (await isPermissionGranted()) {
          await sendNotification({ title: 'Pomodoro', body: '25 min work block done. Take a 5 min break.' });
        }
      } catch {
        /* */
      }
      set({ phase: 'break', phaseStart: Date.now() });
    } else if (s.phase === 'break' && elapsed >= SHORT) {
      if (await isPermissionGranted()) {
        await sendNotification({ title: 'Pomodoro', body: 'Break over — start when ready (Start timer).'});
      }
      set({ phase: 'idle', phaseStart: 0 });
    }
  },
}));

export function workRemainingSeconds(phase: Phase, phaseStart: number, now: number = Date.now()): number {
  if (phase === 'idle' || !phaseStart) return 0;
  const elapsed = Math.floor((now - phaseStart) / 1000);
  if (phase === 'work') return Math.max(0, WORK - elapsed);
  if (phase === 'break') return Math.max(0, SHORT - elapsed);
  return 0;
}

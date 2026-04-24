import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { TimerBar } from './components/TimerBar';
import { useTimer, startTicker } from './state/timer';
import { queryClient } from './lib/query-client';
import './styles.css';

/**
 * Lightweight tray popover. Shares the same SQLite DB as the main window
 * (tauri-plugin-sql opens per-process, so reads/writes are coherent), and
 * stays in sync via the `timer://changed` event broadcast by useTimer.
 */
function PanelApp() {
  const initTimer = useTimer((s) => s.init);
  const running = useTimer((s) => s.running);

  useEffect(() => {
    void initTimer();
    startTicker();
  }, [initTimer]);

  // Re-fetch state every time the panel is shown (tray click).
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged((event) => {
      if (event.payload) void initTimer();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [initTimer]);

  // Auto-hide when the user clicks outside (window loses focus).
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged((event) => {
      if (!event.payload) void win.hide();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for an "open main window" intent from the panel UI.
  useEffect(() => {
    const unlisten = listen('panel://open-main', async () => {
      await getCurrentWindow().hide();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-zinc-200 bg-white/95 p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
      <TimerBar compact />
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              running ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
            }`}
          />
          {running ? 'Tracking now' : 'Idle'}
        </span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          onClick={async () => {
            const win = getCurrentWindow();
            await win.hide();
            // Open main window: emit a global event the Rust side could
            // also listen to; for now just rely on the tray menu.
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('show_window').catch(() => {});
          }}
        >
          Open Tickr
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PanelApp />
    </QueryClientProvider>
  </React.StrictMode>,
);

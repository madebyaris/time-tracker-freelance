import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTimer, startTicker } from './state/timer';
import { queryClient } from './lib/query-client';
import { QuickPanel } from './panel/QuickPanel';
import './styles.css';

/**
 * Lightweight tray popover. Shares the same SQLite DB as the main window
 * (tauri-plugin-sql opens per-process, so reads/writes are coherent), and
 * stays in sync via the `timer://changed` event broadcast by useTimer.
 *
 * Layout is owned by `QuickPanel` (Claude-style focused input + project
 * chip + primary action). This file just wires lifecycle (init store,
 * auto-hide on blur, refetch on focus) and renders the card.
 */
function PanelApp() {
  const initTimer = useTimer((s) => s.init);

  useEffect(() => {
    void initTimer();
    startTicker();
  }, [initTimer]);

  // Re-fetch state every time the panel gains focus (tray click / shortcut).
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

  return <QuickPanel />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PanelApp />
    </QueryClientProvider>
  </React.StrictMode>,
);

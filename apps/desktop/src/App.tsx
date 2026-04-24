import { useEffect, useState, type MouseEvent } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useQuery } from '@tanstack/react-query';
import { cn, TooltipProvider } from '@ttf/ui';
import { TimerBar } from './components/TimerBar';
import { TabBar, tabItems, type Tab } from './components/TabBar';
import { DayView } from './views/DayView';
import { TasksView } from './views/TasksView';
import { ProjectsView } from './views/ProjectsView';
import { ClientsView } from './views/ClientsView';
import { ReportsView } from './views/ReportsView';
import { InvoicesView } from './views/InvoicesView';
import { SettingsView } from './views/SettingsView';
import { useTimer, startTicker } from './state/timer';
import { getDeviceId } from './lib/device';
import { startIdleWatcher } from './lib/idle';
import { startSyncLoop } from './sync/loop';
import { Settings } from './db/repos';
import { staticQueryOptions } from './lib/query-client';

export function App() {
  const [tab, setTab] = useState<Tab>('day');
  const initTimer = useTimer((s) => s.init);
  const toggle = useTimer((s) => s.toggle);
  const start = useTimer((s) => s.start);
  const stop = useTimer((s) => s.stop);
  const running = useTimer((s) => s.running);

  useEffect(() => {
    void getDeviceId();
    void initTimer();
    startTicker();
    startIdleWatcher();
    startSyncLoop();
  }, [initTimer]);

  useEffect(() => {
    const unlistens: Array<Promise<() => void>> = [
      listen('tray://start', () => start({})),
      listen('tray://stop', () => stop()),
      listen('global-shortcut://toggle-timer', () => toggle()),
    ];
    return () => {
      unlistens.forEach((p) => p.then((fn) => fn()));
    };
  }, [start, stop, toggle]);

  // Cmd+1..6 to switch tabs.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const idx = Number.parseInt(event.key, 10);
      if (Number.isNaN(idx) || idx < 1 || idx > tabItems.length) return;
      const next = tabItems[idx - 1];
      if (!next) return;
      event.preventDefault();
      setTab(next.id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const backendQ = useQuery({
    queryKey: ['backend-url'],
    queryFn: () => Settings.get('backend_url'),
    ...staticQueryOptions,
  });

  function startWindowDrag(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    void getCurrentWindow().startDragging().catch(() => {
      // Capability can be unavailable during hot reload; fail quietly.
    });
  }

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={400}>
    <div className="flex h-full text-zinc-900 dark:text-zinc-100">
      <aside className="flex w-[212px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-950/60 max-md:w-[60px]">
        <div
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
          className="titlebar-drag flex h-11 items-center px-3 pl-[76px]"
        >
          {/* In the collapsed (icon-only) sidebar the macOS traffic lights occupy
              roughly the same horizontal space as our logo, so hide the brand
              there and let the system controls act as the window marker. */}
          <div data-tauri-drag-region className="flex items-center gap-2 max-md:hidden">
            <span
              data-tauri-drag-region
              className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-zinc-900 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-950"
            >
              T
            </span>
            <span data-tauri-drag-region className="text-sm font-semibold tracking-tight">
              Tickr
            </span>
          </div>
        </div>

        <div className="px-2 pb-3 pt-1">
          <TabBar value={tab} onChange={setTab} />
        </div>

        <div className="mt-auto border-t border-zinc-200 px-3 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 max-md:px-2">
          <div className="flex items-center justify-between gap-2 max-md:flex-col max-md:items-center max-md:gap-1.5">
            <span className="flex items-center gap-1.5" title={running ? 'Tracking' : 'Idle'}>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  running ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600',
                )}
              />
              <span className="max-md:hidden">{running ? 'Tracking' : 'Idle'}</span>
            </span>
            <span
              className="truncate max-md:hidden"
              title={backendQ.data ? 'Sync on' : 'Local only'}
            >
              {backendQ.data ? 'Sync on' : 'Local only'}
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
          className="titlebar-drag h-11 shrink-0 border-b border-zinc-200 dark:border-zinc-800"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 max-md:p-3">
          <TimerBar />
          <main className="min-h-0 flex-1 overflow-auto">
            {tab === 'day' && <DayView />}
            {tab === 'tasks' && <TasksView />}
            {tab === 'projects' && <ProjectsView />}
            {tab === 'clients' && <ClientsView />}
            {tab === 'reports' && <ReportsView />}
            {tab === 'invoices' && <InvoicesView />}
            {tab === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

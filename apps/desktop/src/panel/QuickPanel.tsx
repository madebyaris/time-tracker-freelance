/*!
 * QuickPanel — the focused horizontal bar that lives in the macOS menubar
 * tray popover. Spotlight/Raycast-style: one row with a "what are you
 * working on?" input, a project chip, and the shared TimerControls cluster.
 *
 *  idle    → [ Start ]
 *  running → [ 12:34 ] [ ⏸ ] [ Stop ]
 *  paused  → [ ⏸ 12:34 ] [ ▶ Resume ] [ Stop ]
 *
 * Pause now actually pauses (entry stays open, ended_at is null). On stop
 * the in-progress pause is folded into `paused_seconds` so the saved
 * duration is correct.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Combobox, Input, cn, type ComboboxOption } from '@ttf/ui';
import { useTimer } from '../state/timer';
import { Clients, Projects } from '../db/repos';
import { staticQueryOptions } from '../lib/query-client';
import {
  buildEntryTargetOptions,
  decodeEntryTarget,
  encodeEntryTarget,
} from '../lib/time-entry-target';
import { TimerControls } from '../components/TimerControls';

export function QuickPanel() {
  const running = useTimer((s) => s.running);
  const tick = useTimer((s) => s.tick);
  const start = useTimer((s) => s.start);
  const stop = useTimer((s) => s.stop);
  const pause = useTimer((s) => s.pause);
  const resume = useTimer((s) => s.resume);

  const inputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState<string | null>(null);

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn: () => Projects.list(),
    ...staticQueryOptions,
  });
  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => Clients.list(),
    ...staticQueryOptions,
  });

  // Mirror the running entry into local state so the panel doesn't lose
  // context when the user reopens it mid-session.
  useEffect(() => {
    if (running) {
      setDescription(running.description ?? '');
      setTarget(encodeEntryTarget(running.project_id, running.client_id));
    }
  }, [running]);

  // Auto-focus the input every time the panel becomes visible. Combined
  // with the window's `focus: false` flag, the focus only happens when the
  // user actively clicks/shortcut-summons the panel.
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged((event) => {
      if (event.payload && !running) {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [running]);

  // Window-level shortcut so ⌘O works even when the Combobox or a button
  // has focus (the input's onKeyDown won't fire in that case).
  useEffect(() => {
    function onWindowKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void (async () => {
          const win = getCurrentWindow();
          await win.hide();
          await invoke('show_window').catch(() => {});
        })();
      }
    }
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);

  const projects = projectsQ.data ?? [];
  const clients = (clientsQ.data ?? []).filter((c) => !c.archived_at);
  const targetOptions: ComboboxOption[] = useMemo(
    () => buildEntryTargetOptions(projects, clients),
    [projects, clients],
  );

  function onStart() {
    const decoded = decodeEntryTarget(target);
    void start({
      project_id: decoded.project_id,
      client_id: decoded.client_id,
      description: description.trim() || null,
    });
  }

  function onStop() {
    void stop();
  }

  function onPause() {
    void pause();
  }

  function onResume() {
    void resume();
  }

  async function openMain() {
    const win = getCurrentWindow();
    await win.hide();
    await invoke('show_window').catch(() => {});
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter starts a timer when idle. While running, Enter is a no-op so the
    // user can edit the description without accidentally stopping the timer;
    // they have to click the explicit Pause / Stop & save button instead.
    if (event.key === 'Enter' && !event.shiftKey && !running) {
      event.preventDefault();
      onStart();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      void getCurrentWindow().hide();
    }
    // ⌘O — swap the panel for the full Tickr window.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void openMain();
    }
  }

  const noTargets = targetOptions.length === 0;
  const isPaused = running?.paused_at != null;

  return (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 px-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
      <span
        aria-hidden
        className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-full transition-colors',
          isPaused
            ? 'bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]'
            : running
              ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]'
              : 'bg-zinc-300 dark:bg-zinc-700',
        )}
      />

      <Input
        ref={inputRef}
        placeholder={running ? running.description ?? 'Tracking…' : 'What are you working on?'}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-12 flex-1 min-w-0 border-transparent bg-transparent text-lg font-medium placeholder:font-normal shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:border-transparent dark:bg-transparent"
      />

      <div className="h-8 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />

      {noTargets ? (
        <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
          Add a project in Tickr
        </span>
      ) : (
        <div className="w-56 shrink-0">
          <Combobox
            value={target}
            onChange={setTarget}
            options={targetOptions}
            size="md"
            placeholder="No project"
            searchPlaceholder="Find project or client…"
            emptyLabel="No matches"
            triggerClassName="h-10 border-transparent bg-zinc-50 text-base hover:bg-zinc-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800"
          />
        </div>
      )}

      <TimerControls
        running={running}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        size="md"
        tick={tick}
      />

      <button
        type="button"
        aria-label="Open Tickr main window"
        title="Open Tickr (⌘O)"
        className="ml-1 flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        onClick={openMain}
      >
        Open
        <kbd className="rounded border border-zinc-300/70 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          ⌘O
        </kbd>
      </button>
    </div>
  );
}

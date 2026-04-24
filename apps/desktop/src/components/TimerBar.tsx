import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Combobox, Input, Kbd, cn, type ComboboxOption } from '@ttf/ui';
import { durationSeconds, formatDuration } from '@ttf/shared';
import { Coffee, Pause, Play } from 'lucide-react';
import { useTimer } from '../state/timer';
import { usePomodoro, workRemainingSeconds } from '../state/pomodoro';
import { Projects, Clients } from '../db/repos';
import { staticQueryOptions } from '../lib/query-client';
import {
  buildEntryTargetOptions,
  decodeEntryTarget,
  encodeEntryTarget,
} from '../lib/time-entry-target';

interface TimerBarProps {
  /** Compact layout — used in the menubar tray panel. */
  compact?: boolean;
}

export function TimerBar({ compact = false }: TimerBarProps) {
  const running = useTimer((s) => s.running);
  useTimer((s) => s.tick);
  const start = useTimer((s) => s.start);
  const stop = useTimer((s) => s.stop);

  const pomEnabled = usePomodoro((s) => s.enabled);
  const setPomEnabled = usePomodoro((s) => s.setEnabled);
  const phase = usePomodoro((s) => s.phase);
  const phaseStart = usePomodoro((s) => s.phaseStart);
  const startSession = usePomodoro((s) => s.startSession);
  const resetPom = usePomodoro((s) => s.reset);
  usePomodoro((s) => s.tick);

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

  useEffect(() => {
    if (running) {
      setDescription(running.description ?? '');
      setTarget(encodeEntryTarget(running.project_id, running.client_id));
    }
  }, [running]);

  const elapsed = running ? durationSeconds(running.started_at, running.ended_at) : 0;
  const pomRemaining =
    phase === 'idle' ? 0 : workRemainingSeconds(phase, phaseStart, Date.now());
  const showPomTimer =
    pomEnabled && (phase === 'work' || phase === 'break') && pomRemaining > 0;

  const projects = projectsQ.data ?? [];
  const clients = (clientsQ.data ?? []).filter((c) => !c.archived_at);

  const targetOptions: ComboboxOption[] = buildEntryTargetOptions(projects, clients);

  function onStart() {
    const decoded = decodeEntryTarget(target);
    if (pomEnabled) startSession();
    void start({
      project_id: decoded.project_id,
      client_id: decoded.client_id,
      description: description || null,
      source: pomEnabled ? 'pomodoro' : 'timer',
    });
  }

  function onStop() {
    void stop();
    if (pomEnabled) resetPom();
  }

  const noTargets = targetOptions.length === 0;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900',
        compact ? 'h-12 px-2' : 'h-14 px-2.5',
      )}
    >
      <span
        className={cn(
          'mx-1 h-2 w-2 shrink-0 rounded-full transition-colors',
          running
            ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
            : 'bg-zinc-300 dark:bg-zinc-700',
        )}
        aria-hidden
      />

      <Input
        placeholder="What are you working on?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !running) onStart();
        }}
        disabled={!!running}
        className={cn(
          'flex-1 border-transparent bg-transparent text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:border-transparent dark:bg-transparent',
          compact ? 'h-8 min-w-0' : 'h-9',
        )}
      />

      <div
        className={cn(
          'shrink-0',
          compact ? 'w-[140px] sm:w-[160px]' : 'w-[160px] md:w-[200px]',
        )}
      >
        {noTargets ? (
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'md'}
            disabled
            className="w-full justify-start text-zinc-500"
            title="Create a project or client to assign this work"
          >
            <span className="text-sm">No projects</span>
          </Button>
        ) : (
          <Combobox
            value={target}
            onChange={setTarget}
            options={targetOptions}
            disabled={!!running}
            size={compact ? 'sm' : 'md'}
            placeholder="No project"
            searchPlaceholder="Find project or client…"
            emptyLabel="No matches"
          />
        )}
      </div>

      {!compact && (
        <Button
          variant={pomEnabled ? 'secondary' : 'outline'}
          size="icon"
          onClick={() => setPomEnabled(!pomEnabled)}
          disabled={!!running}
          title="Pomodoro 25/5"
          className={cn(
            'hidden sm:inline-flex',
            pomEnabled &&
              'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950',
          )}
        >
          <Coffee className="h-4 w-4" />
        </Button>
      )}

      <div
        className={cn(
          'mx-1 flex items-center justify-center rounded-md px-3 font-mono font-semibold tabular-nums leading-none',
          compact ? 'h-8 min-w-[88px] text-base' : 'h-9 min-w-[104px] text-lg',
          showPomTimer
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
            : running
              ? 'text-zinc-900 dark:text-zinc-50'
              : 'text-zinc-400 dark:text-zinc-500',
        )}
      >
        {showPomTimer ? formatDuration(pomRemaining) : formatDuration(elapsed)}
      </div>

      {running ? (
        <Button variant="destructive" size={compact ? 'md' : 'lg'} onClick={onStop}>
          <Pause className="h-4 w-4" />
          {compact ? '' : 'Stop'}
        </Button>
      ) : (
        <Button variant="primary" size={compact ? 'md' : 'lg'} onClick={onStart}>
          <Play className="h-4 w-4" />
          {compact ? '' : 'Start'}
          {!compact && (
            <Kbd className="ml-1 border-emerald-700/30 bg-emerald-700/20 text-emerald-50/90">↵</Kbd>
          )}
        </Button>
      )}
    </div>
  );
}

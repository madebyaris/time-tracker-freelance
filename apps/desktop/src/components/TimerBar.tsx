import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Combobox, Input, cn, type ComboboxOption } from '@ttf/ui';
import { formatDuration } from '@ttf/shared';
import { Coffee } from 'lucide-react';
import { useTimer } from '../state/timer';
import { usePomodoro, workRemainingSeconds } from '../state/pomodoro';
import { Projects, Clients } from '../db/repos';
import { staticQueryOptions } from '../lib/query-client';
import {
  buildEntryTargetOptions,
  decodeEntryTarget,
  encodeEntryTarget,
} from '../lib/time-entry-target';
import { TimerControls } from './TimerControls';

interface TimerBarProps {
  /** Compact layout — used in the menubar tray panel. */
  compact?: boolean;
}

export function TimerBar({ compact = false }: TimerBarProps) {
  const running = useTimer((s) => s.running);
  const tick = useTimer((s) => s.tick);
  const start = useTimer((s) => s.start);
  const stop = useTimer((s) => s.stop);
  const pause = useTimer((s) => s.pause);
  const resume = useTimer((s) => s.resume);

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

  function onPause() {
    void pause();
  }

  function onResume() {
    void resume();
  }

  const noTargets = targetOptions.length === 0;
  const isPaused = running?.paused_at != null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-zinc-900',
        isPaused
          ? 'border-amber-300 dark:border-amber-700/40'
          : 'border-zinc-200 dark:border-zinc-800',
        compact ? 'h-12 px-2' : 'h-14 px-2.5',
      )}
    >
      <span
        className={cn(
          'mx-1 h-2 w-2 shrink-0 rounded-full transition-colors',
          isPaused
            ? 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]'
            : running
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

      {showPomTimer && (
        <div
          className={cn(
            'mx-1 flex items-center justify-center rounded-md px-3 font-mono font-semibold tabular-nums leading-none',
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
            compact ? 'h-8 min-w-[88px] text-base' : 'h-9 min-w-[104px] text-lg',
          )}
          title="Pomodoro session remaining"
        >
          {formatDuration(pomRemaining)}
        </div>
      )}

      <TimerControls
        running={running}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        size={compact ? 'md' : 'lg'}
        tick={tick}
      />
    </div>
  );
}

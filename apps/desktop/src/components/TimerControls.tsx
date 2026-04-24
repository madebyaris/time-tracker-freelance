/*!
 * TimerControls — the primary action cluster for the timer, used in both
 * the QuickPanel (menubar) and the full TimerBar (main window).
 *
 * Renders one of three states based on the running entry:
 *
 *   idle     →  [ Start ]
 *   running  →  [ 12:34 ]  [ ⏸ Pause ]  [ ⏹ Stop ]
 *   paused   →  [ ⏸ 12:34 ] [ ▶ Resume ] [ ⏹ Stop ]
 *
 * Keeping this in one place guarantees the bar and the panel agree on
 * what each button does. "Pause" really means pause now (entry stays
 * open, ended_at is null, elapsed clock freezes).
 */

import { Button, cn } from '@ttf/ui';
import { ArrowRight, Pause, Play, Square } from 'lucide-react';
import { entryDurationSeconds, formatDuration } from '@ttf/shared';
import type { TimeEntry } from '../db/repos';

export interface TimerControlsProps {
  running: TimeEntry | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** Visual size — `lg` for the full app, `md` for the compact panel. */
  size?: 'md' | 'lg';
  /** Force-disable the start button (e.g. while the input is empty). */
  startDisabled?: boolean;
  /** Re-render trigger; pass the per-second tick from `useTimer`. */
  tick?: number;
}

export function TimerControls({
  running,
  onStart,
  onPause,
  onResume,
  onStop,
  size = 'md',
  startDisabled = false,
  tick: _tick,
}: TimerControlsProps) {
  const isPaused = running?.paused_at != null;
  const elapsed = running ? entryDurationSeconds(running) : 0;

  const buttonSize = size === 'lg' ? 'lg' : 'md';
  const iconButtonSize = size === 'lg' ? 'h-11 w-11' : 'h-10 w-10';
  const pillSize =
    size === 'lg'
      ? 'h-11 px-3 text-lg min-w-[104px]'
      : 'h-10 px-3 py-1.5 text-base min-w-[88px]';
  const pillIconSize = size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  if (!running) {
    return (
      <Button
        variant="primary"
        size={buttonSize}
        onClick={onStart}
        disabled={startDisabled}
        aria-label="Start timer"
        className="shrink-0 gap-2"
      >
        <Play className={pillIconSize} />
        Start
        <ArrowRight className={pillIconSize} />
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        aria-label={isPaused ? `Paused at ${formatDuration(elapsed)}` : formatDuration(elapsed)}
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-lg font-mono font-semibold tabular-nums leading-none',
          pillSize,
          isPaused
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50',
        )}
      >
        {isPaused && <Pause className={pillIconSize} />}
        {formatDuration(elapsed)}
      </span>

      {isPaused ? (
        <Button
          variant="primary"
          size={buttonSize}
          onClick={onResume}
          aria-label="Resume timer"
          title="Resume"
          className="shrink-0 gap-2"
        >
          <Play className={pillIconSize} />
          Resume
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          onClick={onPause}
          aria-label="Pause timer"
          title="Pause"
          className={cn('shrink-0', iconButtonSize)}
        >
          <Pause className={pillIconSize} />
        </Button>
      )}

      <Button
        variant="destructive"
        size={buttonSize}
        onClick={onStop}
        aria-label="Stop and save timer"
        title="Stop & save"
        className="shrink-0 gap-2"
      >
        <Square className={pillIconSize} />
        Stop
      </Button>
    </div>
  );
}

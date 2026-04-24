/**
 * Time helpers — entries are stored as start/end unix epoch ms.
 * "duration" everywhere in the app is **seconds** (integer) for easy math.
 */

/**
 * Compute the billable seconds for a time entry, accounting for pause time.
 *
 * Behaviour:
 *  - Stopped entry  → ended_at - started_at - paused_seconds
 *  - Running entry  → now       - started_at - paused_seconds
 *  - Paused entry   → paused_at - started_at - paused_seconds  (frozen)
 *
 * The signature is overloaded so legacy 2-arg call sites keep working.
 */
export function durationSeconds(startedAt: number, endedAt: number | null, now?: number): number;
export function durationSeconds(
  startedAt: number,
  endedAt: number | null,
  pausedAt: number | null,
  pausedSeconds: number,
  now?: number,
): number;
export function durationSeconds(
  startedAt: number,
  endedAt: number | null,
  pausedAtOrNow?: number | null,
  pausedSeconds?: number,
  now?: number,
): number {
  // Two-arg overload: durationSeconds(start, end, now?)
  if (pausedSeconds === undefined) {
    const nowMs = pausedAtOrNow ?? Date.now();
    const end = endedAt ?? nowMs;
    return Math.max(0, Math.floor((end - startedAt) / 1000));
  }
  // Five-arg overload with pause accounting.
  const nowMs = now ?? Date.now();
  const pausedAt = pausedAtOrNow ?? null;
  const effectiveEnd = endedAt ?? pausedAt ?? nowMs;
  const elapsed = Math.floor((effectiveEnd - startedAt) / 1000) - pausedSeconds;
  return Math.max(0, elapsed);
}

/** Convenience helper for any object that looks like a time entry. */
export function entryDurationSeconds(
  entry: {
    started_at: number;
    ended_at: number | null;
    paused_at?: number | null;
    paused_seconds?: number;
  },
  now = Date.now(),
): number {
  return durationSeconds(
    entry.started_at,
    entry.ended_at,
    entry.paused_at ?? null,
    entry.paused_seconds ?? 0,
    now,
  );
}

export function formatDuration(totalSeconds: number, mode: 'hms' | 'hm' | 'decimal' = 'hms'): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (mode === 'decimal') return (s / 3600).toFixed(2) + 'h';
  if (mode === 'hm') return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Hours stored as hundredths (1.5h = 150) for invoice math without floats. */
export function secondsToHundredthsOfHour(seconds: number): number {
  return Math.round((seconds / 3600) * 100);
}

export function hundredthsOfHourToSeconds(hundredths: number): number {
  return Math.round((hundredths / 100) * 3600);
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(ts: number, weekStartsOn = 1 /* Monday */): number {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

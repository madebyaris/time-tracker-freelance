/**
 * Time helpers — entries are stored as start/end unix epoch ms.
 * "duration" everywhere in the app is **seconds** (integer) for easy math.
 */

export function durationSeconds(startedAt: number, endedAt: number | null, now = Date.now()): number {
  const end = endedAt ?? now;
  return Math.max(0, Math.floor((end - startedAt) / 1000));
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

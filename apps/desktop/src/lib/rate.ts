/**
 * Helpers for round-tripping the per-entry hourly rate override between the
 * UI (major-currency string, e.g. "12.50") and the database (integer cents).
 */

/** "12.50" → 1250. Empty/invalid/non-positive → null. */
export function rateOverrideToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

/** 1250 → "12.50". null → "". */
export function centsToRateOverride(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

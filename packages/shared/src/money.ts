/**
 * Money utilities. All amounts are stored as integer minor units (cents)
 * to avoid floating-point errors in invoice math.
 */

export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

/** basis points: 1234 = 12.34% */
export function applyTax(subtotalCents: number, basisPoints: number): number {
  return Math.round((subtotalCents * basisPoints) / 10_000);
}

/** Compute line amount from hours (hundredths) × rate (cents/hr) → cents. */
export function lineAmount(hoursHundredths: number, rateCentsPerHour: number): number {
  return Math.round((hoursHundredths * rateCentsPerHour) / 100);
}

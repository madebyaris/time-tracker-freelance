import type { Client, Project, TimeEntry } from '../db/repos';

export interface EntryBilling {
  rate: number | null;
  currency: string | null;
  /** Where the resolved rate came from. Useful for UI hints. */
  source: 'override' | 'project' | 'client' | null;
}

/**
 * Resolve the effective hourly rate (in cents/hour) and currency for a time
 * entry. Precedence:
 *   1. Per-entry `hourly_rate_cents_override`
 *   2. Project `hourly_rate`
 *   3. Client `default_hourly_rate_cents`
 *
 * Currency falls back: project → client. An entry that is not billable, or
 * whose project is non-billable, yields `null` rate even if an override is
 * present (the toggle is the source of truth).
 */
export function getEntryBilling(
  entry: Pick<TimeEntry, 'billable' | 'hourly_rate_cents_override'>,
  project: Pick<Project, 'hourly_rate' | 'currency' | 'billable'> | null,
  client: Pick<Client, 'default_hourly_rate_cents' | 'currency'> | null,
): EntryBilling {
  if (!entry.billable || project?.billable === 0) {
    return { rate: null, currency: null, source: null };
  }

  const currency = project?.currency ?? client?.currency ?? null;

  if (entry.hourly_rate_cents_override) {
    return {
      rate: entry.hourly_rate_cents_override,
      currency,
      source: 'override',
    };
  }

  if (project?.hourly_rate) {
    return { rate: project.hourly_rate, currency: project.currency, source: 'project' };
  }

  if (client?.default_hourly_rate_cents) {
    return {
      rate: client.default_hourly_rate_cents,
      currency: client.currency,
      source: 'client',
    };
  }

  return { rate: null, currency, source: null };
}

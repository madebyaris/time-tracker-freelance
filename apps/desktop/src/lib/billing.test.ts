import { describe, expect, it } from 'vitest';
import { getEntryBilling } from './billing';
import type { Client, Project, TimeEntry } from '../db/repos';

type Entry = Pick<TimeEntry, 'billable' | 'hourly_rate_cents_override'>;
type Proj = Pick<Project, 'hourly_rate' | 'currency' | 'billable'>;
type Cli = Pick<Client, 'default_hourly_rate_cents' | 'currency'>;

function entry(over: Partial<Entry> = {}): Entry {
  return { billable: 1 as TimeEntry['billable'], hourly_rate_cents_override: null, ...over };
}
function project(over: Partial<Proj> = {}): Proj {
  return { hourly_rate: null, currency: 'USD', billable: 1 as Project['billable'], ...over };
}
function client(over: Partial<Cli> = {}): Cli {
  return { default_hourly_rate_cents: null, currency: 'EUR', ...over };
}

describe('getEntryBilling', () => {
  it('returns null rate when entry is non-billable', () => {
    expect(
      getEntryBilling(entry({ billable: 0 as TimeEntry['billable'] }), project({ hourly_rate: 5000 }), null),
    ).toEqual({ rate: null, currency: null, source: null });
  });

  it('returns null rate when project is non-billable', () => {
    expect(
      getEntryBilling(
        entry({ hourly_rate_cents_override: 9999 }),
        project({ billable: 0 as Project['billable'], hourly_rate: 5000 }),
        client({ default_hourly_rate_cents: 4000 }),
      ),
    ).toEqual({ rate: null, currency: null, source: null });
  });

  it('uses entry override before project rate', () => {
    expect(
      getEntryBilling(
        entry({ hourly_rate_cents_override: 7500 }),
        project({ hourly_rate: 5000, currency: 'USD' }),
        client({ default_hourly_rate_cents: 4000, currency: 'EUR' }),
      ),
    ).toEqual({ rate: 7500, currency: 'USD', source: 'override' });
  });

  it('uses entry override even with no project (currency from client)', () => {
    expect(
      getEntryBilling(
        entry({ hourly_rate_cents_override: 6000 }),
        null,
        client({ default_hourly_rate_cents: 4000, currency: 'EUR' }),
      ),
    ).toEqual({ rate: 6000, currency: 'EUR', source: 'override' });
  });

  it('falls back to project rate when no override', () => {
    expect(
      getEntryBilling(
        entry(),
        project({ hourly_rate: 5500, currency: 'USD' }),
        client({ default_hourly_rate_cents: 4000, currency: 'EUR' }),
      ),
    ).toEqual({ rate: 5500, currency: 'USD', source: 'project' });
  });

  it('falls back to client default when project has no rate', () => {
    expect(
      getEntryBilling(
        entry(),
        project({ hourly_rate: null, currency: 'USD' }),
        client({ default_hourly_rate_cents: 4500, currency: 'EUR' }),
      ),
    ).toEqual({ rate: 4500, currency: 'EUR', source: 'client' });
  });

  it('returns null rate but keeps currency hint when nothing applies', () => {
    expect(
      getEntryBilling(entry(), project({ currency: 'USD' }), null),
    ).toEqual({ rate: null, currency: 'USD', source: null });
  });

  it('returns fully null when entry has no project or client', () => {
    expect(getEntryBilling(entry(), null, null)).toEqual({
      rate: null,
      currency: null,
      source: null,
    });
  });
});

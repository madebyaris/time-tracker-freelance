import { describe, expect, it } from 'vitest';
import { startOfDay } from '@ttf/shared';
import {
  aggregateByDay,
  aggregateByGroup,
  aggregateTotals,
  dayKey,
  effectiveHourlyRateCents,
  formatRevenueByCurrency,
  matchesBillableFilter,
  resolveEntryContext,
  resolveRange,
} from './reporting';
import type { Client, Project, TimeEntry } from '../db/repos';

const DAY_MS = 86_400_000;
/** Wed 2026-07-15, 14:30 local. */
const NOW = new Date(2026, 6, 15, 14, 30).getTime();

function client(over: Partial<Client> = {}): Client {
  return {
    id: 'c1',
    name: 'Acme',
    email: null,
    currency: 'USD',
    notes: null,
    logo_data: null,
    website: null,
    phone: null,
    address: null,
    tax_id: null,
    default_hourly_rate_cents: null,
    archived_at: null,
    updated_at: 0,
    deleted_at: null,
    device_id: 'd',
    ...over,
  };
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    client_id: null,
    name: 'Site',
    color: '#111111',
    hourly_rate: null,
    currency: 'USD',
    billable: 1,
    archived_at: null,
    updated_at: 0,
    deleted_at: null,
    device_id: 'd',
    ...over,
  };
}

/** Defaults to a one-hour stopped entry ending at `NOW`. */
function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    project_id: null,
    client_id: null,
    started_at: NOW - 3_600_000,
    ended_at: NOW,
    paused_at: null,
    paused_seconds: 0,
    description: null,
    billable: 1,
    source: 'timer',
    idle_discarded_seconds: 0,
    hourly_rate_cents_override: null,
    updated_at: 0,
    deleted_at: null,
    device_id: 'd',
    ...over,
  };
}

function maps(projects: Project[] = [], clients: Client[] = []) {
  return [
    new Map(projects.map((p) => [p.id, p])),
    new Map(clients.map((c) => [c.id, c])),
  ] as const;
}

describe('resolveRange', () => {
  it('ends at the exclusive start of tomorrow, not at "now"', () => {
    const range = resolveRange('7d', { now: NOW });
    expect(range.to).toBe(startOfDay(NOW) + DAY_MS);
    expect(range.to).toBeGreaterThan(NOW);
  });

  it('makes a rolling preset inclusive of today', () => {
    const range = resolveRange('7d', { now: NOW });
    expect(range.days).toBe(7);
    expect(range.from).toBe(startOfDay(NOW) - 6 * DAY_MS);
  });

  it('starts the week on Monday', () => {
    // NOW is a Wednesday, so the week began two days earlier.
    const range = resolveRange('this_week', { now: NOW });
    expect(new Date(range.from).getDay()).toBe(1);
    expect(range.days).toBe(3);
  });

  it('covers a whole calendar month for this_month', () => {
    const range = resolveRange('this_month', { now: NOW });
    expect(new Date(range.from).getDate()).toBe(1);
    expect(new Date(range.from).getMonth()).toBe(6);
    expect(range.days).toBe(15);
  });

  it('covers only the previous month for last_month', () => {
    const range = resolveRange('last_month', { now: NOW });
    expect(new Date(range.from).getMonth()).toBe(5);
    expect(new Date(range.to).getMonth()).toBe(6);
    expect(range.days).toBe(30);
  });

  it('snaps this_quarter to the quarter start', () => {
    const range = resolveRange('this_quarter', { now: NOW });
    expect(new Date(range.from).getMonth()).toBe(6);
    expect(new Date(range.from).getDate()).toBe(1);
  });

  it('snaps this_year to January 1', () => {
    const range = resolveRange('this_year', { now: NOW });
    expect(new Date(range.from).getMonth()).toBe(0);
    expect(new Date(range.from).getDate()).toBe(1);
  });

  it('treats a custom range as inclusive of both endpoints', () => {
    const range = resolveRange('custom', {
      customFrom: '2026-07-01',
      customTo: '2026-07-03',
      now: NOW,
    });
    expect(range.days).toBe(3);
    expect(dayKey(range.from)).toBe('2026-07-01');
    expect(dayKey(range.to - 1)).toBe('2026-07-03');
  });

  it('tolerates a reversed custom range instead of reporting nothing', () => {
    const range = resolveRange('custom', {
      customFrom: '2026-07-03',
      customTo: '2026-07-01',
      now: NOW,
    });
    expect(range.days).toBe(3);
    expect(dayKey(range.from)).toBe('2026-07-01');
  });

  it('falls back to a 30-day window on unparseable custom dates', () => {
    const range = resolveRange('custom', { customFrom: 'nonsense', now: NOW });
    expect(range.days).toBe(30);
  });
});

describe('dayKey', () => {
  it('uses the local date, not the UTC date', () => {
    // A local midnight converted through toISOString() lands on the previous
    // day in any positive-offset zone; dayKey must not.
    const localMidnight = startOfDay(NOW);
    expect(dayKey(localMidnight)).toBe('2026-07-15');
  });
});

describe('aggregateTotals', () => {
  const [projById, clientById] = maps(
    [project({ id: 'p1', hourly_rate: 10_000, currency: 'USD' })],
    [],
  );

  it('separates billable intent from revenue eligibility', () => {
    const totals = aggregateTotals(
      [
        entry({ id: 'a', project_id: 'p1' }),
        // Billable intent, but no rate anywhere to invoice against.
        entry({ id: 'b' }),
        entry({ id: 'c', billable: 0 }),
      ],
      projById,
      clientById,
      NOW,
    );
    expect(totals.seconds).toBe(3 * 3600);
    expect(totals.billableSeconds).toBe(3600);
    expect(totals.nonBillableSeconds).toBe(2 * 3600);
    expect(totals.unratedBillableSeconds).toBe(3600);
  });

  it('accumulates revenue in cents per currency', () => {
    const [projects, clients] = maps(
      [
        project({ id: 'p1', hourly_rate: 10_000, currency: 'USD' }),
        project({ id: 'p2', hourly_rate: 5_000, currency: 'EUR' }),
      ],
      [],
    );
    const totals = aggregateTotals(
      [entry({ id: 'a', project_id: 'p1' }), entry({ id: 'b', project_id: 'p2' })],
      projects,
      clients,
      NOW,
    );
    expect(totals.revenueByCurrency.get('USD')).toBe(10_000);
    expect(totals.revenueByCurrency.get('EUR')).toBe(5_000);
  });
});

describe('effectiveHourlyRateCents', () => {
  it('divides revenue by revenue-eligible hours', () => {
    const [projById, clientById] = maps(
      [project({ id: 'p1', hourly_rate: 10_000, currency: 'USD' })],
      [],
    );
    const totals = aggregateTotals(
      [entry({ id: 'a', project_id: 'p1' }), entry({ id: 'b', billable: 0 })],
      projById,
      clientById,
      NOW,
    );
    // Non-billable hours must not drag the rate down.
    expect(effectiveHourlyRateCents(totals)).toEqual({ rateCents: 10_000, currency: 'USD' });
  });

  it('refuses to blend multiple currencies', () => {
    const [projById, clientById] = maps(
      [
        project({ id: 'p1', hourly_rate: 10_000, currency: 'USD' }),
        project({ id: 'p2', hourly_rate: 5_000, currency: 'EUR' }),
      ],
      [],
    );
    const totals = aggregateTotals(
      [entry({ id: 'a', project_id: 'p1' }), entry({ id: 'b', project_id: 'p2' })],
      projById,
      clientById,
      NOW,
    );
    expect(effectiveHourlyRateCents(totals)).toBeNull();
  });

  it('returns null with no billable time', () => {
    const [projById, clientById] = maps();
    expect(
      effectiveHourlyRateCents(aggregateTotals([entry()], projById, clientById, NOW)),
    ).toBeNull();
  });
});

describe('resolveEntryContext', () => {
  it('prefers the client reached through the project', () => {
    const [projById, clientById] = maps(
      [project({ id: 'p1', client_id: 'c1' })],
      [client({ id: 'c1', name: 'Acme' }), client({ id: 'c2', name: 'Other' })],
    );
    const ctx = resolveEntryContext(
      { project_id: 'p1', client_id: 'c2' },
      projById,
      clientById,
    );
    expect(ctx.client?.id).toBe('c1');
  });

  it('falls back to the client attached directly to the entry', () => {
    const [projById, clientById] = maps([], [client({ id: 'c2', name: 'Other' })]);
    const ctx = resolveEntryContext({ project_id: null, client_id: 'c2' }, projById, clientById);
    expect(ctx.client?.id).toBe('c2');
    expect(ctx.project).toBeNull();
  });
});

describe('aggregateByGroup', () => {
  const [projById, clientById] = maps(
    [
      project({ id: 'p1', name: 'Site', client_id: 'c1', hourly_rate: 10_000 }),
      project({ id: 'p2', name: 'App', client_id: 'c1', hourly_rate: 10_000 }),
      project({ id: 'p3', name: 'Solo' }),
    ],
    [client({ id: 'c1', name: 'Acme' })],
  );
  const entries = [
    entry({ id: 'a', project_id: 'p1' }),
    entry({ id: 'b', project_id: 'p2' }),
    entry({ id: 'c', project_id: 'p3', source: 'manual' }),
  ];

  it('keeps a client’s projects separate when grouping by project', () => {
    const groups = aggregateByGroup(entries, 'project', projById, clientById, NOW);
    expect(groups.map((g) => g.name).sort()).toEqual(['App', 'Site', 'Solo']);
  });

  it('rolls a client up across all of its projects', () => {
    const groups = aggregateByGroup(entries, 'client', projById, clientById, NOW);
    const acme = groups.find((g) => g.name === 'Acme');
    expect(acme?.seconds).toBe(2 * 3600);
    expect(acme?.entryCount).toBe(2);
    expect(groups.find((g) => g.name === 'No client')?.seconds).toBe(3600);
  });

  it('groups by entry source', () => {
    const groups = aggregateByGroup(entries, 'source', projById, clientById, NOW);
    expect(groups.find((g) => g.name === 'Timer')?.seconds).toBe(2 * 3600);
    expect(groups.find((g) => g.name === 'Manual')?.seconds).toBe(3600);
  });

  it('sorts groups by tracked time, descending', () => {
    const groups = aggregateByGroup(entries, 'client', projById, clientById, NOW);
    expect(groups[0]!.name).toBe('Acme');
  });

  it('drops the currency when a group mixes them', () => {
    const [mixedProjects, clients] = maps(
      [
        project({ id: 'p1', client_id: 'c1', hourly_rate: 10_000, currency: 'USD' }),
        project({ id: 'p2', client_id: 'c1', hourly_rate: 10_000, currency: 'EUR' }),
      ],
      [client({ id: 'c1' })],
    );
    const groups = aggregateByGroup(
      [entry({ id: 'a', project_id: 'p1' }), entry({ id: 'b', project_id: 'p2' })],
      'client',
      mixedProjects,
      clients,
      NOW,
    );
    expect(groups[0]!.currency).toBeNull();
  });
});

describe('aggregateByDay', () => {
  it('emits one zeroed bucket per day in range', () => {
    const range = resolveRange('7d', { now: NOW });
    const buckets = aggregateByDay([], range, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((bucket) => bucket.hours === 0)).toBe(true);
  });

  it('files entries under their local start date', () => {
    const range = resolveRange('7d', { now: NOW });
    const buckets = aggregateByDay([entry()], range, NOW);
    expect(buckets.at(-1)).toMatchObject({ key: '2026-07-15', hours: 1 });
  });

  it('ignores entries outside the range', () => {
    const range = resolveRange('7d', { now: NOW });
    const buckets = aggregateByDay([entry({ started_at: NOW - 90 * DAY_MS })], range, NOW);
    expect(buckets.reduce((sum, bucket) => sum + bucket.hours, 0)).toBe(0);
  });
});

describe('matchesBillableFilter', () => {
  it('filters on the billable column, not on the resolved rate', () => {
    expect(matchesBillableFilter({ billable: 1 }, 'billable')).toBe(true);
    expect(matchesBillableFilter({ billable: 0 }, 'billable')).toBe(false);
    expect(matchesBillableFilter({ billable: 0 }, 'non_billable')).toBe(true);
    expect(matchesBillableFilter({ billable: 1 }, 'all')).toBe(true);
  });
});

describe('formatRevenueByCurrency', () => {
  it('renders an em dash when there is no revenue', () => {
    expect(formatRevenueByCurrency(new Map())).toBe('—');
    expect(formatRevenueByCurrency(new Map([['USD', 0]]))).toBe('—');
  });

  it('summarises overflow beyond two currencies', () => {
    const label = formatRevenueByCurrency(
      new Map([
        ['USD', 30_000],
        ['EUR', 20_000],
        ['GBP', 10_000],
      ]),
    );
    expect(label).toContain('+1');
  });
});

/**
 * Shared reporting vocabulary for every view that summarises time entries.
 *
 * Two conventions matter and are easy to get wrong independently in each view:
 *
 *  - **Ranges** are half-open: `from` is an inclusive local start-of-day and
 *    `to` is the exclusive start of the day *after* the last day in range.
 *  - **"Billable"** is two different things. The `billable` column is the
 *    user's *intent*; a rate resolved through override → project → client is
 *    what makes time *revenue-eligible*. Time can be billable with no rate,
 *    and that gap is worth surfacing rather than silently dropping.
 */

import { entryDurationSeconds, formatMoney, startOfDay, startOfWeek } from '@ttf/shared';
import type { Client, Project, TimeEntry } from '../db/repos';
import { getEntryBilling } from './billing';

const DAY_MS = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** DST-safe day arithmetic — adding `DAY_MS` drifts by an hour across shifts. */
function addDays(ts: number, amount: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + amount);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfQuarter(ts: number): number {
  const d = new Date(ts);
  d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfYear(ts: number): number {
  const d = new Date(ts);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local `YYYY-MM-DD`. Deriving this from `toISOString()` shifts the date in any non-UTC zone. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local `MM-DD`, for chart axes. */
export function dayLabel(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DD` suitable for an `<input type="date">`. */
export function dateInputValue(ts: number): string {
  return dayKey(ts);
}

// ---------- Ranges ----------

export type RangePreset =
  | '7d'
  | '30d'
  | '90d'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export const RANGE_PRESETS: ReadonlyArray<{ value: RangePreset; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

export function isRangePreset(value: unknown): value is RangePreset {
  return RANGE_PRESETS.some((option) => option.value === value);
}

export interface ResolvedRange {
  /** Inclusive local start-of-day. */
  from: number;
  /** Exclusive — start of the day after the last day in range. */
  to: number;
  /** Whole days covered, never below 1. */
  days: number;
  label: string;
}

export interface RangeOptions {
  /** `YYYY-MM-DD`, only used by the `custom` preset. */
  customFrom?: string;
  customTo?: string;
  now?: number;
}

function parseDateInput(value: string | undefined): number | null {
  if (!value) return null;
  const ts = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function rollingRange(now: number, days: number, label: string): ResolvedRange {
  const today = startOfDay(now);
  return { from: addDays(today, -(days - 1)), to: addDays(today, 1), days, label };
}

function spanRange(from: number, toExclusive: number, label: string): ResolvedRange {
  const days = Math.max(1, Math.round((toExclusive - from) / DAY_MS));
  return { from, to: toExclusive, days, label };
}

export function resolveRange(preset: RangePreset, opts: RangeOptions = {}): ResolvedRange {
  const now = opts.now ?? Date.now();
  const today = startOfDay(now);

  switch (preset) {
    case '7d':
      return rollingRange(now, 7, 'Last 7 days');
    case '30d':
      return rollingRange(now, 30, 'Last 30 days');
    case '90d':
      return rollingRange(now, 90, 'Last 90 days');
    case 'this_week':
      return spanRange(startOfWeek(now), addDays(today, 1), 'This week');
    case 'this_month':
      return spanRange(startOfMonth(now), addDays(today, 1), 'This month');
    case 'last_month': {
      const thisMonth = startOfMonth(now);
      const lastMonth = startOfMonth(thisMonth - DAY_MS);
      return spanRange(lastMonth, thisMonth, 'Last month');
    }
    case 'this_quarter':
      return spanRange(startOfQuarter(now), addDays(today, 1), 'This quarter');
    case 'this_year':
      return spanRange(startOfYear(now), addDays(today, 1), 'This year');
    case 'custom': {
      const from = parseDateInput(opts.customFrom) ?? addDays(today, -29);
      const lastDay = parseDateInput(opts.customTo) ?? today;
      // Tolerate a reversed range rather than returning an empty report.
      const start = Math.min(from, lastDay);
      const end = Math.max(from, lastDay);
      return spanRange(start, addDays(end, 1), 'Custom range');
    }
  }
}

// ---------- Entry facts ----------

export interface EntryContext {
  project: Project | null;
  client: Client | null;
}

/** A client reached through the entry's project takes precedence over a directly attached one. */
export function resolveEntryContext(
  entry: Pick<TimeEntry, 'project_id' | 'client_id'>,
  projById: Map<string, Project>,
  clientById: Map<string, Client>,
): EntryContext {
  const project = entry.project_id ? projById.get(entry.project_id) ?? null : null;
  const client =
    (project?.client_id ? clientById.get(project.client_id) ?? null : null) ??
    (entry.client_id ? clientById.get(entry.client_id) ?? null : null);
  return { project, client };
}

export interface EntryFacts {
  seconds: number;
  /** The `billable` toggle — intent, independent of whether a rate exists. */
  billableIntent: boolean;
  rateCents: number | null;
  currency: string | null;
  /** Minor units (cents), matching `formatMoney`. Zero when no rate resolved. */
  revenueCents: number;
  /** A rate resolved, so this time can actually be invoiced. */
  revenueEligible: boolean;
}

export function entryFacts(entry: TimeEntry, ctx: EntryContext, now?: number): EntryFacts {
  const seconds = entryDurationSeconds(entry, now);
  const billing = getEntryBilling(entry, ctx.project, ctx.client);
  const revenueEligible = billing.rate != null;
  return {
    seconds,
    billableIntent: !!entry.billable,
    rateCents: billing.rate,
    currency: billing.currency,
    revenueCents: billing.rate ? (seconds / 3600) * billing.rate : 0,
    revenueEligible,
  };
}

// ---------- Filters ----------

export type BillableFilter = 'all' | 'billable' | 'non_billable';
export type SourceFilter = 'all' | TimeEntry['source'];

export const BILLABLE_FILTERS: ReadonlyArray<{ value: BillableFilter; label: string }> = [
  { value: 'all', label: 'All entries' },
  { value: 'billable', label: 'Billable only' },
  { value: 'non_billable', label: 'Non-billable only' },
];

export function isBillableFilter(value: unknown): value is BillableFilter {
  return BILLABLE_FILTERS.some((option) => option.value === value);
}

export function matchesBillableFilter(
  entry: Pick<TimeEntry, 'billable'>,
  filter: BillableFilter,
): boolean {
  if (filter === 'billable') return !!entry.billable;
  if (filter === 'non_billable') return !entry.billable;
  return true;
}

export function matchesSourceFilter(
  entry: Pick<TimeEntry, 'source'>,
  filter: SourceFilter,
): boolean {
  return filter === 'all' || entry.source === filter;
}

// ---------- Aggregation ----------

export type GroupBy = 'project' | 'client' | 'source';

export const GROUP_BY_OPTIONS: ReadonlyArray<{ value: GroupBy; label: string }> = [
  { value: 'project', label: 'Project' },
  { value: 'client', label: 'Client' },
  { value: 'source', label: 'Source' },
];

export function isGroupBy(value: unknown): value is GroupBy {
  return GROUP_BY_OPTIONS.some((option) => option.value === value);
}

export interface GroupTotal {
  key: string;
  name: string;
  color: string;
  seconds: number;
  /** Seconds with a resolved rate. */
  billableSeconds: number;
  nonBillableSeconds: number;
  revenueCents: number;
  /** Null when the group mixes currencies or has no rate at all. */
  currency: string | null;
  entryCount: number;
}

const UNASSIGNED_COLOR = '#a1a1aa';

const GROUP_PALETTE = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#06b6d4',
  '#ef4444',
];

/** Stable per-key colour so a chart keeps its colours as totals shift. */
function paletteColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return GROUP_PALETTE[Math.abs(hash) % GROUP_PALETTE.length]!;
}

const SOURCE_LABELS: Record<TimeEntry['source'], string> = {
  timer: 'Timer',
  manual: 'Manual',
  pomodoro: 'Pomodoro',
  calendar: 'Calendar',
};

function groupIdentity(
  entry: TimeEntry,
  ctx: EntryContext,
  groupBy: GroupBy,
): { key: string; name: string; color: string } {
  if (groupBy === 'source') {
    return {
      key: `source:${entry.source}`,
      name: SOURCE_LABELS[entry.source] ?? entry.source,
      color: paletteColor(entry.source),
    };
  }

  if (groupBy === 'client') {
    if (!ctx.client) return { key: 'none', name: 'No client', color: UNASSIGNED_COLOR };
    return {
      key: `client:${ctx.client.id}`,
      name: ctx.client.name,
      color: paletteColor(ctx.client.id),
    };
  }

  if (ctx.project) {
    return {
      key: `project:${ctx.project.id}`,
      name: ctx.project.name,
      color: ctx.project.color ?? paletteColor(ctx.project.id),
    };
  }
  if (ctx.client) {
    return {
      key: `client:${ctx.client.id}`,
      name: `${ctx.client.name} (no project)`,
      color: paletteColor(ctx.client.id),
    };
  }
  return { key: 'none', name: 'No project', color: UNASSIGNED_COLOR };
}

export function aggregateByGroup(
  entries: TimeEntry[],
  groupBy: GroupBy,
  projById: Map<string, Project>,
  clientById: Map<string, Client>,
  now?: number,
): GroupTotal[] {
  const totals = new Map<string, GroupTotal & { currencies: Set<string> }>();

  for (const entry of entries) {
    const ctx = resolveEntryContext(entry, projById, clientById);
    const facts = entryFacts(entry, ctx, now);
    const identity = groupIdentity(entry, ctx, groupBy);

    let group = totals.get(identity.key);
    if (!group) {
      group = {
        ...identity,
        seconds: 0,
        billableSeconds: 0,
        nonBillableSeconds: 0,
        revenueCents: 0,
        currency: null,
        entryCount: 0,
        currencies: new Set<string>(),
      };
      totals.set(identity.key, group);
    }

    group.seconds += facts.seconds;
    group.revenueCents += facts.revenueCents;
    group.entryCount += 1;
    if (facts.revenueEligible) {
      group.billableSeconds += facts.seconds;
      if (facts.currency) group.currencies.add(facts.currency);
    } else {
      group.nonBillableSeconds += facts.seconds;
    }
  }

  return [...totals.values()]
    .map(({ currencies, ...group }) => ({
      ...group,
      currency: currencies.size === 1 ? [...currencies][0]! : null,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

export interface DayBucket {
  key: string;
  day: string;
  hours: number;
}

export function aggregateByDay(
  entries: TimeEntry[],
  range: ResolvedRange,
  now?: number,
): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  for (let cursor = range.from; cursor < range.to; cursor = addDays(cursor, 1)) {
    buckets.set(dayKey(cursor), { key: dayKey(cursor), day: dayLabel(cursor), hours: 0 });
  }

  for (const entry of entries) {
    const bucket = buckets.get(dayKey(entry.started_at));
    if (!bucket) continue;
    bucket.hours += entryDurationSeconds(entry, now) / 3600;
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    hours: Number(bucket.hours.toFixed(2)),
  }));
}

export interface Totals {
  seconds: number;
  /** Seconds with a resolved rate. */
  billableSeconds: number;
  nonBillableSeconds: number;
  /** Seconds flagged billable that have no rate to invoice against. */
  unratedBillableSeconds: number;
  /** Minor units (cents) keyed by currency. */
  revenueByCurrency: Map<string, number>;
  entryCount: number;
}

export function aggregateTotals(
  entries: TimeEntry[],
  projById: Map<string, Project>,
  clientById: Map<string, Client>,
  now?: number,
): Totals {
  const totals: Totals = {
    seconds: 0,
    billableSeconds: 0,
    nonBillableSeconds: 0,
    unratedBillableSeconds: 0,
    revenueByCurrency: new Map(),
    entryCount: entries.length,
  };

  for (const entry of entries) {
    const ctx = resolveEntryContext(entry, projById, clientById);
    const facts = entryFacts(entry, ctx, now);
    totals.seconds += facts.seconds;
    if (facts.revenueEligible) {
      totals.billableSeconds += facts.seconds;
      if (facts.currency) {
        totals.revenueByCurrency.set(
          facts.currency,
          (totals.revenueByCurrency.get(facts.currency) ?? 0) + facts.revenueCents,
        );
      }
    } else {
      totals.nonBillableSeconds += facts.seconds;
      if (facts.billableIntent) totals.unratedBillableSeconds += facts.seconds;
    }
  }

  return totals;
}

/**
 * Revenue per revenue-eligible hour. Only meaningful within a single currency,
 * so a mixed-currency range yields null rather than a misleading blend.
 */
export function effectiveHourlyRateCents(
  totals: Totals,
): { rateCents: number; currency: string } | null {
  if (totals.revenueByCurrency.size !== 1 || totals.billableSeconds <= 0) return null;
  const [currency, revenueCents] = [...totals.revenueByCurrency.entries()][0]!;
  return { rateCents: revenueCents / (totals.billableSeconds / 3600), currency };
}

export function formatRevenueByCurrency(byCurrency: Map<string, number>): string {
  const entries = [...byCurrency.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '—';
  const head = entries
    .slice(0, 2)
    .map(([currency, amount]) => formatMoney(Math.round(amount), currency))
    .join(' · ');
  return entries.length > 2 ? `${head} +${entries.length - 2}` : head;
}

export function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

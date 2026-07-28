import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { TimeEntries, Projects, Clients } from '../db/repos';
import { formatDuration } from '@ttf/shared';
import {
  entryFacts,
  matchesBillableFilter,
  matchesSourceFilter,
  resolveEntryContext,
  type BillableFilter,
  type SourceFilter,
} from './reporting';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface CsvExportOptions {
  from: number;
  to: number;
  source?: SourceFilter;
  billable?: BillableFilter;
  /** Restrict to one project, or to a client across all of its projects. */
  target?: { projectId?: string | null; clientId?: string | null } | null;
  /** Slug appended to the suggested filename, e.g. `this-month`. */
  fileLabel?: string;
}

export async function exportEntriesCsv(opts: CsvExportOptions): Promise<string | null> {
  const [entries, projects, clients] = await Promise.all([
    TimeEntries.list({ from: opts.from, to: opts.to }),
    Projects.list({ includeArchived: true }),
    Clients.list(),
  ]);
  const projById = new Map(projects.map((p) => [p.id, p]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const source = opts.source ?? 'all';
  const billable = opts.billable ?? 'all';
  const targetProjectId = opts.target?.projectId ?? null;
  const targetClientId = opts.target?.clientId ?? null;

  const filtered = entries.filter((entry) => {
    if (!matchesSourceFilter(entry, source)) return false;
    if (!matchesBillableFilter(entry, billable)) return false;
    if (targetProjectId && entry.project_id !== targetProjectId) return false;
    if (targetClientId) {
      const ctx = resolveEntryContext(entry, projById, clientById);
      if (ctx.client?.id !== targetClientId) return false;
    }
    return true;
  });

  const header = [
    'date',
    'started_at',
    'ended_at',
    'duration_hms',
    'duration_hours',
    'project',
    'client',
    'description',
    'billable',
    'source',
    'rate_override_cents',
    'effective_rate_cents',
    'currency',
    'revenue',
    'entry_id',
    'project_id',
    'client_id',
  ];
  const rows = filtered.map((entry) => {
    const ctx = resolveEntryContext(entry, projById, clientById);
    const facts = entryFacts(entry, ctx);
    return [
      new Date(entry.started_at).toISOString().slice(0, 10),
      new Date(entry.started_at).toISOString(),
      entry.ended_at ? new Date(entry.ended_at).toISOString() : '',
      formatDuration(facts.seconds, 'hms'),
      (facts.seconds / 3600).toFixed(4),
      ctx.project?.name ?? '',
      ctx.client?.name ?? '',
      entry.description ?? '',
      entry.billable ? 'yes' : 'no',
      entry.source,
      entry.hourly_rate_cents_override ?? '',
      facts.rateCents ?? '',
      facts.currency ?? '',
      facts.revenueEligible ? (facts.revenueCents / 100).toFixed(2) : '',
      entry.id,
      ctx.project?.id ?? '',
      ctx.client?.id ?? '',
    ]
      .map(escapeCsv)
      .join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');

  const suffix = opts.fileLabel ? `-${opts.fileLabel}` : '';
  const path = await save({
    title: 'Export entries',
    defaultPath: `tickr-export${suffix}-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!path) return null;
  await writeTextFile(path, csv);
  return path;
}

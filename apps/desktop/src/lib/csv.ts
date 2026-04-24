import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { TimeEntries, Projects, Clients } from '../db/repos';
import { entryDurationSeconds, formatDuration } from '@ttf/shared';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportEntriesCsv(opts: { from: number; to: number }): Promise<string | null> {
  const [entries, projects, clients] = await Promise.all([
    TimeEntries.list({ from: opts.from, to: opts.to }),
    Projects.list({ includeArchived: true }),
    Clients.list(),
  ]);
  const projById = new Map(projects.map((p) => [p.id, p]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

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
  ];
  const rows = entries.map((e) => {
    const dur = entryDurationSeconds(e);
    const proj = e.project_id ? projById.get(e.project_id) : null;
    const cli = proj?.client_id ? clientById.get(proj.client_id) : null;
    return [
      new Date(e.started_at).toISOString().slice(0, 10),
      new Date(e.started_at).toISOString(),
      e.ended_at ? new Date(e.ended_at).toISOString() : '',
      formatDuration(dur, 'hms'),
      (dur / 3600).toFixed(4),
      proj?.name ?? '',
      cli?.name ?? '',
      e.description ?? '',
      e.billable ? 'yes' : 'no',
      e.source,
    ].map(escapeCsv).join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');

  const path = await save({
    title: 'Export entries',
    defaultPath: `tickr-export-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!path) return null;
  await writeTextFile(path, csv);
  return path;
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Combobox,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  SegmentedControl,
  Select,
  cn,
  type ComboboxOption,
} from '@ttf/ui';
import {
  entryDurationSeconds,
  formatDuration,
  formatMoney,
  startOfDay,
} from '@ttf/shared';
import { History, Trash2, X } from 'lucide-react';
import {
  Clients,
  Projects,
  TimeEntries,
  type Client,
  type Project,
  type TimeEntry,
} from '../db/repos';
import { useTimer } from '../state/timer';
import { liveQueryOptions, staticQueryOptions } from '../lib/query-client';
import {
  buildEntryTargetOptions,
  decodeEntryTarget,
  encodeEntryTarget,
} from '../lib/time-entry-target';
import { getEntryBilling } from '../lib/billing';
import {
  EntryFormFields,
  centsToRateOverride,
  rateOverrideToCents,
  type EntryFormValue,
} from '../components/EntryFormFields';

type Range = '7d' | '30d' | '90d' | 'custom';

const rangeOptions: Array<{ value: Range; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'custom', label: 'Custom' },
];

type SourceFilter = 'all' | TimeEntry['source'];
type BillableFilter = 'all' | 'billable' | 'non_billable';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateInputValue(ts: number): string {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeInputValue(ts: number): string {
  const date = new Date(ts);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combineDateTime(dateValue: string, timeValue: string): number {
  return new Date(`${dateValue}T${timeValue}:00`).getTime();
}

function entryToFormValue(entry: TimeEntry): EntryFormValue {
  return {
    description: entry.description ?? '',
    target: encodeEntryTarget(entry.project_id, entry.client_id),
    date: dateInputValue(entry.started_at),
    start: timeInputValue(entry.started_at),
    end: entry.ended_at ? timeInputValue(entry.ended_at) : '',
    billable: !!entry.billable,
    rateOverride: centsToRateOverride(entry.hourly_rate_cents_override),
  };
}

function emptyForm(): EntryFormValue {
  const today = dateInputValue(Date.now());
  return {
    description: '',
    target: null,
    date: today,
    start: '09:00',
    end: '10:00',
    billable: true,
    rateOverride: '',
  };
}

function resolveTargetContext(
  target: string | null,
  projById: Map<string, Project>,
  clientById: Map<string, Client>,
): { project: Project | null; client: Client | null } {
  const decoded = decodeEntryTarget(target);
  const project = decoded.project_id ? projById.get(decoded.project_id) ?? null : null;
  const client = decoded.client_id
    ? clientById.get(decoded.client_id) ?? null
    : project?.client_id
      ? clientById.get(project.client_id) ?? null
      : null;
  return { project, client };
}

export function TimeLogView() {
  const qc = useQueryClient();
  useTimer((s) => s.tick);

  const [range, setRange] = useState<Range>('30d');
  const todayStart = startOfDay(Date.now());
  const [customFrom, setCustomFrom] = useState(dateInputValue(todayStart - 30 * 86_400_000));
  const [customTo, setCustomTo] = useState(dateInputValue(todayStart));

  const { from, to } = useMemo(() => {
    if (range === 'custom') {
      const f = new Date(`${customFrom}T00:00:00`).getTime();
      const t = new Date(`${customTo}T00:00:00`).getTime() + 86_400_000;
      return { from: Number.isNaN(f) ? todayStart : f, to: Number.isNaN(t) ? todayStart + 86_400_000 : t };
    }
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return {
      from: todayStart - (days - 1) * 86_400_000,
      to: todayStart + 86_400_000,
    };
  }, [range, customFrom, customTo, todayStart]);

  const [source, setSource] = useState<SourceFilter>('all');
  const [billableFilter, setBillableFilter] = useState<BillableFilter>('all');
  const [targetFilter, setTargetFilter] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryFormValue>(emptyForm);

  const entriesQ = useQuery({
    queryKey: ['entries', 'time-log', from, to],
    queryFn: () => TimeEntries.list({ from, to }),
    ...liveQueryOptions,
  });
  const projectsQ = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => Projects.list({ includeArchived: true }),
    ...staticQueryOptions,
  });
  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: () => Clients.list(),
    ...staticQueryOptions,
  });

  const projById = useMemo(
    () => new Map((projectsQ.data ?? []).map((p) => [p.id, p])),
    [projectsQ.data],
  );
  const clientById = useMemo(
    () => new Map((clientsQ.data ?? []).map((c) => [c.id, c])),
    [clientsQ.data],
  );

  const targetOptions = useMemo(
    () =>
      buildEntryTargetOptions(
        projectsQ.data ?? [],
        (clientsQ.data ?? []).filter((client) => !client.archived_at),
      ),
    [projectsQ.data, clientsQ.data],
  );
  const filterOptions: ComboboxOption[] = useMemo(
    () => [{ value: '__all__', label: 'All projects & clients' }, ...targetOptions],
    [targetOptions],
  );

  const filtered = useMemo(() => {
    const entries = (entriesQ.data ?? []).filter((entry) => {
      if (source !== 'all' && entry.source !== source) return false;
      if (billableFilter === 'billable' && !entry.billable) return false;
      if (billableFilter === 'non_billable' && entry.billable) return false;
      if (targetFilter && targetFilter !== '__all__') {
        const decoded = decodeEntryTarget(targetFilter);
        if (decoded.project_id && entry.project_id !== decoded.project_id) return false;
        if (decoded.client_id) {
          const proj = entry.project_id ? projById.get(entry.project_id) : null;
          const matchesEntryClient = entry.client_id === decoded.client_id;
          const matchesProjectClient = proj?.client_id === decoded.client_id;
          if (!matchesEntryClient && !matchesProjectClient) return false;
        }
      }
      return true;
    });
    return entries;
  }, [entriesQ.data, source, billableFilter, targetFilter, projById]);

  const stats = useMemo(() => {
    let totalSeconds = 0;
    let billableSeconds = 0;
    const revenueByCurrency = new Map<string, number>();
    for (const entry of filtered) {
      const project = entry.project_id ? projById.get(entry.project_id) ?? null : null;
      const client = (project?.client_id ? clientById.get(project.client_id) : null) ??
        (entry.client_id ? clientById.get(entry.client_id) : null);
      const billing = getEntryBilling(entry, project, client ?? null);
      const secs = entryDurationSeconds(entry);
      totalSeconds += secs;
      if (billing.rate) {
        billableSeconds += secs;
        if (billing.currency) {
          const amt = (secs / 3600) * billing.rate;
          revenueByCurrency.set(billing.currency, (revenueByCurrency.get(billing.currency) ?? 0) + amt);
        }
      }
    }
    return { totalSeconds, billableSeconds, revenueByCurrency };
  }, [filtered, projById, clientById]);

  const editingEntry = filtered.find((entry) => entry.id === editingId) ?? null;
  const editContext = resolveTargetContext(editForm.target, projById, clientById);
  const editInheritedRate =
    editContext.project?.hourly_rate ??
    editContext.client?.default_hourly_rate_cents ??
    null;
  const editInheritedSource: 'project' | 'client' | null = editContext.project?.hourly_rate
    ? 'project'
    : editContext.client?.default_hourly_rate_cents
      ? 'client'
      : null;
  const editCurrency = editContext.project?.currency ?? editContext.client?.currency ?? 'USD';

  const remove = useMutation({
    mutationFn: (id: string) => TimeEntries.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async () => {
      if (!editingEntry) throw new Error('Select an entry to edit');
      if (!editingEntry.ended_at) {
        throw new Error('Stop the running timer before editing this entry');
      }

      const decoded = decodeEntryTarget(editForm.target);
      const startedAt = combineDateTime(editForm.date, editForm.start);
      const endedAt = combineDateTime(editForm.date, editForm.end);

      if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
        throw new Error('Enter a valid date and time range');
      }
      if (endedAt <= startedAt) {
        throw new Error('End time must be after start time');
      }

      // Manual time edits replace the recorded window — drop the prior pause
      // accounting so duration math matches the new range.
      const timesChanged =
        startedAt !== editingEntry.started_at || endedAt !== editingEntry.ended_at;

      return TimeEntries.update(editingEntry.id, {
        project_id: decoded.project_id,
        client_id: decoded.client_id,
        started_at: startedAt,
        ended_at: endedAt,
        description: editForm.description.trim() || null,
        billable: editForm.billable,
        hourly_rate_cents_override: rateOverrideToCents(editForm.rateOverride),
        ...(timesChanged ? { paused_at: null, paused_seconds: 0 } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      closeEdit();
    },
  });

  function openEdit(entry: TimeEntry) {
    if (!entry.ended_at) return;
    updateEntry.reset();
    setEditForm(entryToFormValue(entry));
    setEditingId(entry.id);
  }

  function closeEdit() {
    updateEntry.reset();
    setEditingId(null);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Time Log
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Edit time and rates
          </h1>
        </div>
        <SegmentedControl value={range} onChange={setRange} options={rangeOptions} />
      </header>

      {range === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>From</FieldLabel>
            <Input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>To</FieldLabel>
            <Input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tracked" value={formatDuration(stats.totalSeconds, 'hm')} />
        <Stat label="Billable" value={formatDuration(stats.billableSeconds, 'hm')} />
        <Stat label="Revenue" value={formatRevenue(stats.revenueByCurrency)} />
        <Stat label="Entries" value={String(filtered.length)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel>Source</FieldLabel>
          <Select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}>
            <option value="all">All sources</option>
            <option value="timer">Timer</option>
            <option value="manual">Manual</option>
            <option value="pomodoro">Pomodoro</option>
            <option value="calendar">Calendar</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Billable</FieldLabel>
          <Select
            value={billableFilter}
            onChange={(event) => setBillableFilter(event.target.value as BillableFilter)}
          >
            <option value="all">All entries</option>
            <option value="billable">Billable only</option>
            <option value="non_billable">Non-billable only</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Project / client</FieldLabel>
          <Combobox
            value={targetFilter}
            onChange={setTargetFilter}
            options={filterOptions}
            placeholder="All projects & clients"
            searchPlaceholder="Find project or client…"
            emptyLabel="No matches"
          />
        </Field>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {entriesQ.isLoading && (
          <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">Loading…</div>
        )}

        {!entriesQ.isLoading && filtered.length === 0 && (
          <EmptyState
            className="m-3 border-0 bg-transparent py-12"
            icon={History}
            title="No entries match"
            description="Adjust the date range or filters to find time you've already tracked."
          />
        )}

        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.map((entry) => {
            const project = entry.project_id ? projById.get(entry.project_id) ?? null : null;
            const client = (project?.client_id ? clientById.get(project.client_id) : null) ??
              (entry.client_id ? clientById.get(entry.client_id) ?? null : null);
            const billing = getEntryBilling(entry, project, client ?? null);
            const secs = entryDurationSeconds(entry);
            const isLive = !entry.ended_at;
            const isEditing = editingId === entry.id;
            const targetLabel =
              project?.name ?? (client ? `${client.name} (no project)` : 'No project');

            if (isEditing) {
              return (
                <li key={entry.id} className="px-3 py-3">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Edit entry · {entry.source}
                        </div>
                        <h2 className="mt-1 text-base font-semibold tracking-tight">
                          {targetLabel}
                        </h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close edit form"
                        onClick={closeEdit}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <EntryFormFields
                        value={editForm}
                        onChange={setEditForm}
                        targetOptions={targetOptions}
                        rateCurrency={editCurrency}
                        inheritedRateCents={editInheritedRate}
                        inheritedRateSource={editInheritedSource}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-red-600">
                        {updateEntry.error ? (updateEntry.error as Error).message : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={closeEdit}>
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => updateEntry.mutate()}
                          disabled={updateEntry.isPending}
                        >
                          Save changes
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            }

            const revenue =
              billing.rate && billing.currency ? (secs / 3600) * billing.rate : null;
            const sourceLabel = entry.source.charAt(0).toUpperCase() + entry.source.slice(1);

            return (
              <li
                key={entry.id}
                className={cn(
                  'group grid grid-cols-[minmax(0,1fr)_120px_140px_120px_auto] items-center gap-3 px-3 py-2.5 text-sm',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-900/60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: project?.color ?? (client ? '#71717a' : '#a1a1aa'),
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {entry.description || (
                          <span className="text-zinc-400">Untitled session</span>
                        )}
                      </span>
                      {isLive && (
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          live
                        </span>
                      )}
                      {entry.hourly_rate_cents_override != null && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          rate override
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {targetLabel} · {sourceLabel} · {fmtDate(entry.started_at)}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatDuration(secs, 'hm')}
                </div>

                <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                  {billing.rate
                    ? `${(billing.rate / 100).toFixed(2)} ${billing.currency ?? ''}/h`
                    : entry.billable
                      ? 'No rate'
                      : 'Non-billable'}
                </div>

                <div className="text-right font-mono tabular-nums">
                  {revenue != null && billing.currency
                    ? formatMoney(Math.round(revenue), billing.currency)
                    : '—'}
                </div>

                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(entry)}
                    disabled={isLive}
                    title={isLive ? 'Stop the timer to edit' : undefined}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete entry"
                    onClick={() => {
                      if (confirm('Delete this entry?')) remove.mutate(entry.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRevenue(byCurrency: Map<string, number>): string {
  const entries = [...byCurrency.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '—';
  if (entries.length === 1) {
    return formatMoney(Math.round(entries[0]![1]), entries[0]![0]);
  }
  const head = entries
    .slice(0, 2)
    .map(([cur, amt]) => formatMoney(Math.round(amt), cur))
    .join(' · ');
  return entries.length > 2 ? `${head} +${entries.length - 2}` : head;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

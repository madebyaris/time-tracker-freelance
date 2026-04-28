import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button, EmptyState } from '@ttf/ui';
import { entryDurationSeconds, formatDuration, startOfDay } from '@ttf/shared';
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2, X } from 'lucide-react';
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

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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

function defaultManualForm(day: number): EntryFormValue {
  const today = startOfDay(Date.now());
  let date: string;
  let start: string;
  let end: string;

  if (day === today) {
    const endDate = new Date();
    endDate.setSeconds(0, 0);
    endDate.setMinutes(Math.floor(endDate.getMinutes() / 5) * 5);
    const startDate = new Date(endDate.getTime() - 60 * 60 * 1000);
    date = dateInputValue(endDate.getTime());
    start = timeInputValue(startDate.getTime());
    end = timeInputValue(endDate.getTime());
  } else {
    date = dateInputValue(day);
    start = '09:00';
    end = '10:00';
  }

  return {
    description: '',
    target: null,
    date,
    start,
    end,
    billable: true,
    rateOverride: '',
  };
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

export function DayView() {
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<EntryFormValue>(() => defaultManualForm(day));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryFormValue>(() => defaultManualForm(day));
  useTimer((s) => s.tick);
  const running = useTimer((s) => s.running);
  const qc = useQueryClient();

  const entriesQ = useQuery({
    queryKey: ['entries', day],
    queryFn: () => TimeEntries.list({ from: day, to: day + 86_400_000 }),
    ...liveQueryOptions,
  });
  const projectsQ = useQuery({
    queryKey: ['projects'],
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

  const manualContext = resolveTargetContext(manualForm.target, projById, clientById);
  const manualInheritedRate =
    manualContext.project?.hourly_rate ??
    manualContext.client?.default_hourly_rate_cents ??
    null;
  const manualInheritedSource: 'project' | 'client' | null = manualContext.project?.hourly_rate
    ? 'project'
    : manualContext.client?.default_hourly_rate_cents
      ? 'client'
      : null;
  const manualCurrency =
    manualContext.project?.currency ?? manualContext.client?.currency ?? 'USD';

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

  const displayEntries = useMemo(() => {
    const entries = [...(entriesQ.data ?? [])];
    if (
      running &&
      running.started_at >= day &&
      running.started_at < day + 86_400_000 &&
      !entries.some((entry) => entry.id === running.id)
    ) {
      entries.unshift(running);
    }
    return entries;
  }, [day, entriesQ.data, running]);

  const totalSeconds = displayEntries.reduce(
    (sum, e) => sum + entryDurationSeconds(e),
    0,
  );

  const billableSeconds = displayEntries
    .filter((entry) => {
      const project = entry.project_id ? projById.get(entry.project_id) : null;
      const client = (project?.client_id ? clientById.get(project.client_id) : null) ??
        (entry.client_id ? clientById.get(entry.client_id) : null);
      return getEntryBilling(entry, project ?? null, client ?? null).rate;
    })
    .reduce((sum, e) => sum + entryDurationSeconds(e), 0);

  const remove = useMutation({
    mutationFn: (id: string) => TimeEntries.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });
  const createManual = useMutation({
    mutationFn: async () => {
      const decoded = decodeEntryTarget(manualForm.target);
      const startedAt = combineDateTime(manualForm.date, manualForm.start);
      const endedAt = combineDateTime(manualForm.date, manualForm.end);

      if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
        throw new Error('Enter a valid date and time range');
      }
      if (endedAt <= startedAt) {
        throw new Error('End time must be after start time');
      }

      return TimeEntries.createManual({
        project_id: decoded.project_id,
        client_id: decoded.client_id,
        started_at: startedAt,
        ended_at: endedAt,
        description: manualForm.description.trim() || null,
        billable: manualForm.billable,
        hourly_rate_cents_override: rateOverrideToCents(manualForm.rateOverride),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      resetManualForm(day);
      setShowManualForm(false);
    },
  });
  const updateEntry = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('Select an entry to edit');
      const entry = (entriesQ.data ?? []).find((item) => item.id === editingId);
      if (!entry || !entry.ended_at) throw new Error('Only completed entries can be edited');

      const decoded = decodeEntryTarget(editForm.target);
      const startedAt = combineDateTime(editForm.date, editForm.start);
      const endedAt = combineDateTime(editForm.date, editForm.end);

      if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
        throw new Error('Enter a valid date and time range');
      }
      if (endedAt <= startedAt) {
        throw new Error('End time must be after start time');
      }

      // When the user edits the time range manually, the previous pause
      // accounting no longer matches the new window — replace it cleanly.
      const timesChanged =
        startedAt !== entry.started_at || endedAt !== entry.ended_at;

      return TimeEntries.update(editingId, {
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
      closeEditForm();
    },
  });

  const isToday = day === startOfDay(Date.now());
  const dayLabel = new Date(day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function resetManualForm(nextDay: number) {
    setManualForm(defaultManualForm(nextDay));
  }

  function openManualForm() {
    closeEditForm();
    resetManualForm(day);
    setShowManualForm(true);
  }

  function closeEditForm() {
    updateEntry.reset();
    setEditingId(null);
    setEditForm(defaultManualForm(day));
  }

  function openEditForm(entry: TimeEntry) {
    createManual.reset();
    setShowManualForm(false);
    setEditForm(entryToFormValue(entry));
    setEditingId(entry.id);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Today
            {isToday && (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                live
              </span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{dayLabel}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={openManualForm}>
            <Plus className="h-3.5 w-3.5" />
            Add time
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous day"
            onClick={() => setDay(day - 86_400_000)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isToday}
            onClick={() => setDay(startOfDay(Date.now()))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next day"
            disabled={isToday}
            onClick={() => setDay(day + 86_400_000)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SummaryStat label="Tracked" value={formatDuration(totalSeconds, 'hm')} />
        <SummaryStat label="Billable" value={formatDuration(billableSeconds, 'hm')} />
        <SummaryStat label="Sessions" value={String(displayEntries.length)} />
      </div>

      {showManualForm && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Manual entry
              </div>
              <h2 className="mt-1 text-base font-semibold tracking-tight">Add missed time</h2>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close manual time form"
              onClick={() => {
                createManual.reset();
                resetManualForm(day);
                setShowManualForm(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <EntryFormFields
              value={manualForm}
              onChange={setManualForm}
              targetOptions={targetOptions}
              rateCurrency={manualCurrency}
              inheritedRateCents={manualInheritedRate}
              inheritedRateSource={manualInheritedSource}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-red-600">
              {createManual.error ? (createManual.error as Error).message : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  createManual.reset();
                  resetManualForm(day);
                  setShowManualForm(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={() => createManual.mutate()} disabled={createManual.isPending}>
                Save time
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {entriesQ.isLoading && (
          <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">Loading…</div>
        )}
        {!entriesQ.isLoading && displayEntries.length === 0 && (
          <EmptyState
            className="m-3 border-0 bg-transparent py-12"
            icon={Clock}
            title="No entries yet"
            description="Press Start above or hit Return in the description field to log your first session."
          />
        )}
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {displayEntries.map((entry) => {
            const project = entry.project_id ? projById.get(entry.project_id) : null;
            const client = entry.client_id
              ? clientById.get(entry.client_id) ?? null
              : project?.client_id
                ? clientById.get(project.client_id) ?? null
                : null;
            const dur = entryDurationSeconds(entry);
            const isLive = !entry.ended_at;
            const targetLabel = project?.name ?? (client ? `${client.name} (no project)` : 'No project');
            const isEditing = editingId === entry.id;
            return (
              <li
                key={entry.id}
                className={
                  isEditing
                    ? 'px-3 py-3'
                    : 'group flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                }
              >
                {isEditing ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Edit entry
                        </div>
                        <h2 className="mt-1 text-base font-semibold tracking-tight">
                          {targetLabel}
                        </h2>
                      </div>
                      <div className="font-mono text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatDuration(dur, 'hms')}
                      </div>
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
                        <Button variant="outline" size="sm" onClick={closeEditForm}>
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
                ) : (
                  <>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project?.color ?? (client ? '#71717a' : '#a1a1aa') }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {entry.description || (
                            <span className="text-zinc-400">Untitled session</span>
                          )}
                        </span>
                        {isLive && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            live
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {targetLabel} · {fmtTime(entry.started_at)}–
                        {entry.ended_at ? fmtTime(entry.ended_at) : 'now'}
                      </div>
                    </div>
                    <div className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatDuration(dur, 'hms')}
                    </div>
                    {!isLive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => openEditForm(entry)}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete entry"
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => {
                        if (confirm('Delete this entry?')) remove.mutate(entry.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
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

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button, Combobox, EmptyState, Field, FieldLabel, Input } from '@ttf/ui';
import { durationSeconds, formatDuration, startOfDay } from '@ttf/shared';
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2, X } from 'lucide-react';
import { TimeEntries, Projects, Clients, type TimeEntry } from '../db/repos';
import { useTimer } from '../state/timer';
import { liveQueryOptions, staticQueryOptions } from '../lib/query-client';
import {
  buildEntryTargetOptions,
  decodeEntryTarget,
  encodeEntryTarget,
} from '../lib/time-entry-target';

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

function defaultManualRange(day: number): { date: string; start: string; end: string } {
  const today = startOfDay(Date.now());
  if (day === today) {
    const end = new Date();
    end.setSeconds(0, 0);
    end.setMinutes(Math.floor(end.getMinutes() / 5) * 5);
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    return {
      date: dateInputValue(end.getTime()),
      start: timeInputValue(start.getTime()),
      end: timeInputValue(end.getTime()),
    };
  }

  return {
    date: dateInputValue(day),
    start: '09:00',
    end: '10:00',
  };
}

export function DayView() {
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualTarget, setManualTarget] = useState<string | null>(null);
  const manualDefaults = defaultManualRange(day);
  const [manualDate, setManualDate] = useState(manualDefaults.date);
  const [manualStart, setManualStart] = useState(manualDefaults.start);
  const [manualEnd, setManualEnd] = useState(manualDefaults.end);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(manualDefaults.date);
  const [editStart, setEditStart] = useState(manualDefaults.start);
  const [editEnd, setEditEnd] = useState(manualDefaults.end);
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
  const projById = new Map((projectsQ.data ?? []).map((p) => [p.id, p]));
  const clientById = new Map((clientsQ.data ?? []).map((c) => [c.id, c]));
  const targetOptions = buildEntryTargetOptions(
    projectsQ.data ?? [],
    (clientsQ.data ?? []).filter((client) => !client.archived_at),
  );

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
    (sum, e) => sum + durationSeconds(e.started_at, e.ended_at),
    0,
  );

  const billableSeconds = displayEntries
    .filter((entry) => {
      const project = entry.project_id ? projById.get(entry.project_id) : null;
      return entry.billable && project?.hourly_rate;
    })
    .reduce((sum, e) => sum + durationSeconds(e.started_at, e.ended_at), 0);

  const remove = useMutation({
    mutationFn: (id: string) => TimeEntries.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });
  const createManual = useMutation({
    mutationFn: async () => {
      const decoded = decodeEntryTarget(manualTarget);
      const startedAt = combineDateTime(manualDate, manualStart);
      const endedAt = combineDateTime(manualDate, manualEnd);

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
        description: manualDescription.trim() || null,
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

      const decoded = decodeEntryTarget(editTarget);
      const startedAt = combineDateTime(editDate, editStart);
      const endedAt = combineDateTime(editDate, editEnd);

      if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
        throw new Error('Enter a valid date and time range');
      }
      if (endedAt <= startedAt) {
        throw new Error('End time must be after start time');
      }

      return TimeEntries.update(editingId, {
        project_id: decoded.project_id,
        client_id: decoded.client_id,
        started_at: startedAt,
        ended_at: endedAt,
        description: editDescription.trim() || null,
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
    const defaults = defaultManualRange(nextDay);
    setManualDescription('');
    setManualTarget(null);
    setManualDate(defaults.date);
    setManualStart(defaults.start);
    setManualEnd(defaults.end);
  }

  function openManualForm() {
    closeEditForm();
    resetManualForm(day);
    setShowManualForm(true);
  }

  function populateEditForm(entry: TimeEntry) {
    setEditDescription(entry.description ?? '');
    setEditTarget(encodeEntryTarget(entry.project_id, entry.client_id));
    setEditDate(dateInputValue(entry.started_at));
    setEditStart(timeInputValue(entry.started_at));
    setEditEnd(entry.ended_at ? timeInputValue(entry.ended_at) : '');
  }

  function closeEditForm() {
    updateEntry.reset();
    setEditingId(null);
    setEditDescription('');
    setEditTarget(null);
    setEditDate(manualDefaults.date);
    setEditStart(manualDefaults.start);
    setEditEnd(manualDefaults.end);
  }

  function openEditForm(entry: TimeEntry) {
    createManual.reset();
    setShowManualForm(false);
    populateEditForm(entry);
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
              description={manualDescription}
              onDescriptionChange={setManualDescription}
              target={manualTarget}
              onTargetChange={setManualTarget}
              targetOptions={targetOptions}
              date={manualDate}
              onDateChange={setManualDate}
              start={manualStart}
              onStartChange={setManualStart}
              end={manualEnd}
              onEndChange={setManualEnd}
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
            const dur = durationSeconds(entry.started_at, entry.ended_at);
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
                        description={editDescription}
                        onDescriptionChange={setEditDescription}
                        target={editTarget}
                        onTargetChange={setEditTarget}
                        targetOptions={targetOptions}
                        date={editDate}
                        onDateChange={setEditDate}
                        start={editStart}
                        onStartChange={setEditStart}
                        end={editEnd}
                        onEndChange={setEditEnd}
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

function EntryFormFields({
  description,
  onDescriptionChange,
  target,
  onTargetChange,
  targetOptions,
  date,
  onDateChange,
  start,
  onStartChange,
  end,
  onEndChange,
}: {
  description: string;
  onDescriptionChange: (value: string) => void;
  target: string | null;
  onTargetChange: (value: string | null) => void;
  targetOptions: ReturnType<typeof buildEntryTargetOptions>;
  date: string;
  onDateChange: (value: string) => void;
  start: string;
  onStartChange: (value: string) => void;
  end: string;
  onEndChange: (value: string) => void;
}) {
  return (
    <>
      <Field className="md:col-span-2">
        <FieldLabel>Task</FieldLabel>
        <Input
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="What were you working on?"
        />
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel>Project or client</FieldLabel>
        <Combobox
          value={target}
          onChange={onTargetChange}
          options={targetOptions}
          placeholder="No project"
          searchPlaceholder="Find project or client…"
          emptyLabel="No projects or clients yet"
        />
      </Field>
      <Field>
        <FieldLabel>Date</FieldLabel>
        <Input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Start</FieldLabel>
        <Input type="time" value={start} onChange={(event) => onStartChange(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>End</FieldLabel>
        <Input type="time" value={end} onChange={(event) => onEndChange(event.target.value)} />
      </Field>
    </>
  );
}

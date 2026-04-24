import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Combobox,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  Textarea,
  cn,
} from '@ttf/ui';
import { startOfDay } from '@ttf/shared';
import {
  Calendar,
  Check,
  ChevronDown,
  ListTodo,
  Pencil,
  Play,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { Clients, Projects, Tasks, type Task } from '../db/repos';
import { liveQueryOptions, staticQueryOptions } from '../lib/query-client';
import { useTimer } from '../state/timer';
import { buildEntryTargetOptions, decodeEntryTarget, encodeEntryTarget } from '../lib/time-entry-target';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateInputValue(ts: number): string {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function dueLabel(due: number, today: number): { label: string; tone: 'overdue' | 'today' | 'soon' | 'later' } {
  const day = startOfDay(due);
  const diffDays = Math.round((day - today) / 86_400_000);
  if (diffDays < 0) {
    if (diffDays === -1) return { label: 'Yesterday', tone: 'overdue' };
    if (diffDays > -7) return { label: `${-diffDays}d overdue`, tone: 'overdue' };
    return {
      label: new Date(due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      tone: 'overdue',
    };
  }
  if (diffDays === 0) return { label: 'Today', tone: 'today' };
  if (diffDays === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (diffDays < 7)
    return {
      label: new Date(due).toLocaleDateString(undefined, { weekday: 'short' }),
      tone: 'soon',
    };
  return {
    label: new Date(due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    tone: 'later',
  };
}

type Section = {
  key: string;
  title: string;
  description?: string;
  tasks: Task[];
};

export function TasksView() {
  const qc = useQueryClient();
  const start = useTimer((s) => s.start);
  const today = startOfDay(Date.now());

  const tasksQ = useQuery({
    queryKey: ['tasks'],
    queryFn: () => Tasks.list({ includeCompleted: true }),
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
  const targetOptions = useMemo(
    () =>
      buildEntryTargetOptions(
        projectsQ.data ?? [],
        (clientsQ.data ?? []).filter((c) => !c.archived_at),
      ),
    [projectsQ.data, clientsQ.data],
  );

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState<string | null>(null);
  const [newDue, setNewDue] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');
  const [showNewNotes, setShowNewNotes] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editDue, setEditDue] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');

  /** Tasks whose notes are expanded inline in the list. */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sections = useMemo<Section[]>(() => {
    const all = tasksQ.data ?? [];
    const open = all.filter((t) => !t.completed_at);
    const completed = all
      .filter((t) => t.completed_at)
      .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0))
      .slice(0, 25);

    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const upcoming: Task[] = [];
    const inbox: Task[] = [];
    const tomorrow = today + 86_400_000;

    for (const task of open) {
      if (task.due_at == null) {
        inbox.push(task);
        continue;
      }
      const day = startOfDay(task.due_at);
      if (day < today) overdue.push(task);
      else if (day < tomorrow) todayTasks.push(task);
      else upcoming.push(task);
    }

    return [
      { key: 'overdue', title: 'Overdue', description: 'Past due date', tasks: overdue },
      { key: 'today', title: 'Today', tasks: todayTasks },
      { key: 'upcoming', title: 'Upcoming', tasks: upcoming },
      { key: 'inbox', title: 'Inbox', description: 'No due date', tasks: inbox },
      { key: 'completed', title: 'Recently completed', tasks: completed },
    ].filter((section) => section.tasks.length > 0 || section.key === 'today');
  }, [tasksQ.data, today]);

  const create = useMutation({
    mutationFn: async () => {
      const title = newTitle.trim();
      if (!title) throw new Error('Add a title');
      const decoded = decodeEntryTarget(newTarget);
      return Tasks.create({
        title,
        notes: newNotes.trim() || null,
        project_id: decoded.project_id,
        client_id: decoded.client_id,
        due_at: parseDateInput(newDue),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      resetCreate();
      setCreating(false);
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('No task selected');
      const title = editTitle.trim();
      if (!title) throw new Error('Add a title');
      const decoded = decodeEntryTarget(editTarget);
      return Tasks.update(editingId, {
        title,
        notes: editNotes.trim() || null,
        project_id: decoded.project_id,
        client_id: decoded.client_id,
        due_at: parseDateInput(editDue),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      closeEdit();
    },
  });

  const toggleCompleted = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      Tasks.setCompleted(id, completed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => Tasks.softDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  function resetCreate() {
    setNewTitle('');
    setNewTarget(null);
    setNewDue('');
    setNewNotes('');
    setShowNewNotes(false);
  }

  function openCreate(presetDue?: number) {
    closeEdit();
    resetCreate();
    if (presetDue) setNewDue(dateInputValue(presetDue));
    setCreating(true);
  }

  function openEdit(task: Task) {
    create.reset();
    setCreating(false);
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditTarget(encodeEntryTarget(task.project_id, task.client_id));
    setEditDue(task.due_at ? dateInputValue(task.due_at) : '');
    setEditNotes(task.notes ?? '');
  }

  function closeEdit() {
    update.reset();
    setEditingId(null);
    setEditTitle('');
    setEditTarget(null);
    setEditDue('');
    setEditNotes('');
  }

  async function startFromTask(task: Task) {
    await start({
      project_id: task.project_id,
      client_id: task.client_id,
      description: task.title,
      source: 'timer',
    });
  }

  const totalOpen = sections
    .filter((s) => s.key !== 'completed')
    .reduce((sum, s) => sum + s.tasks.length, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tasks
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">What's on your plate</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
            {totalOpen} open
          </span>
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" />
            New task
          </Button>
        </div>
      </header>

      {creating && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                New task
              </div>
              <h2 className="mt-1 text-base font-semibold tracking-tight">Plan something</h2>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close new task form"
              onClick={() => {
                create.reset();
                resetCreate();
                setCreating(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel>Title</FieldLabel>
              <Input
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="What needs doing?"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && newTitle.trim()) {
                    event.preventDefault();
                    create.mutate();
                  }
                }}
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>Project or client</FieldLabel>
              <Combobox
                value={newTarget}
                onChange={setNewTarget}
                options={targetOptions}
                placeholder="No project"
                searchPlaceholder="Find project or client…"
                emptyLabel="No projects or clients yet"
              />
            </Field>
            <Field>
              <FieldLabel>Due date</FieldLabel>
              <Input type="date" value={newDue} onChange={(event) => setNewDue(event.target.value)} />
            </Field>
            {showNewNotes ? (
              <Field className="md:col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <Textarea
                  value={newNotes}
                  onChange={(event) => setNewNotes(event.target.value)}
                  placeholder="Add details, links, acceptance criteria…"
                  rows={4}
                />
              </Field>
            ) : (
              <div className="md:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-1.5"
                  onClick={() => setShowNewNotes(true)}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Add notes
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-red-600">
              {create.error ? (create.error as Error).message : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  create.reset();
                  resetCreate();
                  setCreating(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                Add task
              </Button>
            </div>
          </div>
        </div>
      )}

      {tasksQ.isLoading && (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Loading…
        </div>
      )}

      {!tasksQ.isLoading && totalOpen === 0 && !creating && (
        <EmptyState
          icon={ListTodo}
          title="Inbox zero"
          description="No open tasks. Add one to plan your day or to remember something for later."
          action={
            <Button variant="primary" size="sm" onClick={() => openCreate()}>
              <Plus className="h-3.5 w-3.5" />
              New task
            </Button>
          }
        />
      )}

      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-2">
          <div className="flex items-end justify-between px-1">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
                {section.title}
              </h2>
              {section.description && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{section.description}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {section.tasks.length}
              </span>
              {section.key === 'today' && section.tasks.length === 0 && !creating && (
                <Button variant="ghost" size="sm" onClick={() => openCreate(today)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            </div>
          </div>

          {section.tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              Nothing here. Quiet day ahead.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {section.tasks.map((task) => {
                const project = task.project_id ? projById.get(task.project_id) ?? null : null;
                const client = task.client_id
                  ? clientById.get(task.client_id) ?? null
                  : project?.client_id
                    ? clientById.get(project.client_id) ?? null
                    : null;
                const targetLabel = project?.name ?? client?.name ?? null;
                const targetColor = project?.color ?? null;
                const isCompleted = !!task.completed_at;
                const isEditing = editingId === task.id;
                const due = task.due_at != null ? dueLabel(task.due_at, today) : null;

                const hasNotes = !!task.notes && task.notes.trim().length > 0;
                const isExpanded = expanded.has(task.id);

                return (
                  <li
                    key={task.id}
                    className={cn(
                      isEditing
                        ? 'p-3'
                        : 'group flex flex-col hover:bg-zinc-50 dark:hover:bg-zinc-900/60',
                    )}
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field className="md:col-span-2">
                            <FieldLabel>Title</FieldLabel>
                            <Input
                              autoFocus
                              value={editTitle}
                              onChange={(event) => setEditTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && editTitle.trim()) {
                                  event.preventDefault();
                                  update.mutate();
                                }
                                if (event.key === 'Escape') closeEdit();
                              }}
                            />
                          </Field>
                          <Field className="md:col-span-2">
                            <FieldLabel>Project or client</FieldLabel>
                            <Combobox
                              value={editTarget}
                              onChange={setEditTarget}
                              options={targetOptions}
                              placeholder="No project"
                              searchPlaceholder="Find project or client…"
                              emptyLabel="No projects or clients yet"
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Due date</FieldLabel>
                            <Input
                              type="date"
                              value={editDue}
                              onChange={(event) => setEditDue(event.target.value)}
                            />
                          </Field>
                          <Field className="md:col-span-2">
                            <FieldLabel>Notes</FieldLabel>
                            <Textarea
                              value={editNotes}
                              onChange={(event) => setEditNotes(event.target.value)}
                              placeholder="Add details, links, acceptance criteria…"
                              rows={4}
                            />
                          </Field>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-red-600">
                            {update.error ? (update.error as Error).message : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={closeEdit}>
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => update.mutate()}
                              disabled={update.isPending}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 px-3 py-2">
                          <button
                            type="button"
                            aria-label={isCompleted ? 'Mark as not done' : 'Mark as done'}
                            onClick={() =>
                              toggleCompleted.mutate({ id: task.id, completed: !isCompleted })
                            }
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                              isCompleted
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-zinc-300 text-transparent hover:border-zinc-400 hover:text-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500',
                            )}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'truncate text-sm',
                                  isCompleted
                                    ? 'text-zinc-400 line-through dark:text-zinc-500'
                                    : 'font-medium text-zinc-900 dark:text-zinc-100',
                                )}
                              >
                                {task.title}
                              </span>
                              {hasNotes && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(task.id)}
                                  aria-label={isExpanded ? 'Hide notes' : 'Show notes'}
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                                  title={isExpanded ? 'Hide notes' : 'Show notes'}
                                >
                                  <StickyNote className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                              {targetLabel && (
                                <span className="inline-flex items-center gap-1">
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: targetColor ?? '#a1a1aa' }}
                                  />
                                  {targetLabel}
                                </span>
                              )}
                              {due && (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]',
                                    due.tone === 'overdue' &&
                                      'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
                                    due.tone === 'today' &&
                                      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                                    due.tone === 'soon' &&
                                      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                                    due.tone === 'later' &&
                                      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                                  )}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {due.label}
                                </span>
                              )}
                              {!targetLabel && !due && !hasNotes && (
                                <span>No project · No due date</span>
                              )}
                            </div>
                          </div>
                          {!isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                              onClick={() => void startFromTask(task)}
                              title="Start timer with this task"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Start
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit task"
                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => openEdit(task)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete task"
                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => {
                              if (confirm('Delete this task?')) remove.mutate(task.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {hasNotes && isExpanded && (
                          <div className="border-t border-zinc-100 bg-zinc-50/40 px-3 py-2 pl-11 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(task.id)}
                              className="-mx-1 mb-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                              <ChevronDown className="h-3 w-3" />
                              Notes
                            </button>
                            <p className="whitespace-pre-wrap">{task.notes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

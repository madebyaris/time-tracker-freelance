import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Button,
  Combobox,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  cn,
} from '@ttf/ui';
import { Archive, ArchiveRestore, FolderKanban, Plus } from 'lucide-react';
import { Projects, Clients } from '../db/repos';
import { staticQueryOptions } from '../lib/query-client';

const palette = [
  '#18181b',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];
const defaultProjectColor = '#3b82f6';

export function ProjectsView() {
  const qc = useQueryClient();
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

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [rate, setRate] = useState('');
  const [color, setColor] = useState(defaultProjectColor);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editColor, setEditColor] = useState(defaultProjectColor);

  const create = useMutation({
    mutationFn: () =>
      Projects.create({
        name: name.trim(),
        client_id: clientId,
        hourly_rate: rate ? Math.round(parseFloat(rate) * 100) : null,
        color,
      }),
    onSuccess: () => {
      resetCreateForm();
      qc.invalidateQueries({ queryKey: ['projects-all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('Select a project to edit');
      return Projects.update(editingId, {
        name: editName.trim(),
        client_id: editClientId,
        hourly_rate: editRate ? Math.round(parseFloat(editRate) * 100) : null,
        color: editColor,
      });
    },
    onSuccess: () => {
      resetEditForm();
      qc.invalidateQueries({ queryKey: ['projects-all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      Projects.update(id, { archived }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const projects = projectsQ.data ?? [];
  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);
  const clients = clientsQ.data ?? [];
  const clientById = new Map(clients.map((c) => [c.id, c]));

  function resetCreateForm() {
    create.reset();
    setName('');
    setRate('');
    setClientId(null);
    setColor(defaultProjectColor);
    setCreating(false);
  }

  function resetEditForm() {
    update.reset();
    setEditingId(null);
    setEditName('');
    setEditRate('');
    setEditClientId(null);
    setEditColor(defaultProjectColor);
  }

  function openEditForm(project: (typeof projects)[number]) {
    resetCreateForm();
    setEditName(project.name);
    setEditClientId(project.client_id);
    setEditRate(project.hourly_rate ? (project.hourly_rate / 100).toFixed(2) : '');
    setEditColor(project.color);
    setEditingId(project.id);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Projects
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {active.length} active · {archived.length} archived
          </h1>
        </div>
        {!creating && (
          <Button variant="primary" size="md" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        )}
      </header>

      {creating && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <ProjectFormFields
            clients={clients}
            name={name}
            onNameChange={setName}
            clientId={clientId}
            onClientIdChange={setClientId}
            rate={rate}
            onRateChange={setRate}
            color={color}
            onColorChange={setColor}
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={resetCreateForm}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
            >
              Create project
            </Button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to assign rates and track billable work."
          action={
            !creating && (
              <Button variant="primary" size="md" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" />
                New project
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[...active, ...archived].map((project) => {
              const client = project.client_id ? clientById.get(project.client_id) : null;
              const isEditing = editingId === project.id;
              return (
                <li
                  key={project.id}
                  className={
                    isEditing
                      ? 'px-3 py-3'
                      : 'group flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                  }
                >
                  {isEditing ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Edit project
                        </div>
                        {project.archived_at && (
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            archived
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 text-base font-semibold tracking-tight">{project.name}</h2>
                      <div className="mt-4">
                        <ProjectFormFields
                          clients={clients}
                          name={editName}
                          onNameChange={setEditName}
                          clientId={editClientId}
                          onClientIdChange={setEditClientId}
                          rate={editRate}
                          onRateChange={setEditRate}
                          color={editColor}
                          onColorChange={setEditColor}
                        />
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-red-600">
                          {update.error ? (update.error as Error).message : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={resetEditForm}>
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => update.mutate()}
                            disabled={!editName.trim() || update.isPending}
                          >
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{project.name}</span>
                          {project.archived_at && (
                            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              archived
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {client?.name ?? 'No client'}
                          {project.hourly_rate
                            ? ` · ${(project.hourly_rate / 100).toFixed(2)} ${project.currency}/h`
                            : ' · no rate'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => openEditForm(project)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={project.archived_at ? 'Unarchive' : 'Archive'}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() =>
                          archive.mutate({ id: project.id, archived: !project.archived_at })
                        }
                      >
                        {project.archived_at ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProjectFormFields({
  clients,
  name,
  onNameChange,
  clientId,
  onClientIdChange,
  rate,
  onRateChange,
  color,
  onColorChange,
}: {
  clients: Array<{ id: string; name: string; currency: string }>;
  name: string;
  onNameChange: (value: string) => void;
  clientId: string | null;
  onClientIdChange: (value: string | null) => void;
  rate: string;
  onRateChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="proj-name">Name</FieldLabel>
        <Input
          id="proj-name"
          placeholder="e.g. Acme website redesign"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>Client</FieldLabel>
        <Combobox
          value={clientId}
          onChange={onClientIdChange}
          options={clients.map((client) => ({
            value: client.id,
            label: client.name,
            hint: client.currency,
          }))}
          placeholder="No client"
          searchPlaceholder="Find client…"
          emptyLabel="No clients yet"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="proj-rate">Hourly rate</FieldLabel>
        <Input
          id="proj-rate"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={rate}
          onChange={(e) => onRateChange(e.target.value)}
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel>Color</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {palette.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              onClick={() => onColorChange(swatch)}
              style={{ backgroundColor: swatch }}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform',
                color === swatch
                  ? 'scale-110 border-zinc-900 dark:border-white'
                  : 'border-transparent hover:scale-105',
              )}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}

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
  const [color, setColor] = useState(palette[1]);

  const create = useMutation({
    mutationFn: () =>
      Projects.create({
        name,
        client_id: clientId,
        hourly_rate: rate ? Math.round(parseFloat(rate) * 100) : null,
        color,
      }),
    onSuccess: () => {
      setName('');
      setRate('');
      setClientId(null);
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['projects-all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="proj-name">Name</FieldLabel>
              <Input
                id="proj-name"
                autoFocus
                placeholder="e.g. Acme website redesign"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Client</FieldLabel>
              <Combobox
                value={clientId}
                onChange={setClientId}
                options={clients.map((c) => ({ value: c.id, label: c.name, hint: c.currency }))}
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
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel>Color</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {palette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={cn(
                      'h-6 w-6 rounded-full border-2 transition-transform',
                      color === c
                        ? 'scale-110 border-zinc-900 dark:border-white'
                        : 'border-transparent hover:scale-105',
                    )}
                  />
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => create.mutate()}
              disabled={!name || create.isPending}
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
              return (
                <li
                  key={project.id}
                  className="group flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
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
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

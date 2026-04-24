import type { Client, Project } from '../db/repos';
import type { ComboboxOption } from '@ttf/ui';

export function encodeEntryTarget(projectId: string | null, clientId: string | null): string | null {
  if (projectId) return `p:${projectId}`;
  if (clientId) return `c:${clientId}`;
  return null;
}

export function decodeEntryTarget(value: string | null): {
  project_id: string | null;
  client_id: string | null;
} {
  if (!value) return { project_id: null, client_id: null };
  if (value.startsWith('p:')) return { project_id: value.slice(2), client_id: null };
  if (value.startsWith('c:')) return { project_id: null, client_id: value.slice(2) };
  return { project_id: null, client_id: null };
}

export function initialsOfName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function buildEntryTargetOptions(projects: Project[], clients: Client[]): ComboboxOption[] {
  const options: ComboboxOption[] = [];

  for (const project of projects) {
    options.push({
      value: `p:${project.id}`,
      label: project.name,
      color: project.color,
      group: 'Projects',
      hint: project.hourly_rate
        ? `${(project.hourly_rate / 100).toFixed(0)} ${project.currency}/h`
        : undefined,
    });
  }

  for (const client of clients) {
    options.push({
      value: `c:${client.id}`,
      label: client.name,
      initials: initialsOfName(client.name) || '·',
      group: 'Clients',
      hint: client.currency,
    });
  }

  return options;
}

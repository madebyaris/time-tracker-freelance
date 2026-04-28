import { cn, Kbd, Tooltip } from '@ttf/ui';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Clock4,
  FileText,
  FolderKanban,
  ListTodo,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export type Tab =
  | 'day'
  | 'timeLog'
  | 'tasks'
  | 'projects'
  | 'clients'
  | 'reports'
  | 'invoices'
  | 'settings';

export const tabItems: Array<{
  id: Tab;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}> = [
  { id: 'day', label: 'Today', icon: CalendarDays, shortcut: '1' },
  { id: 'timeLog', label: 'Time Log', icon: Clock4, shortcut: '2' },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, shortcut: '3' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, shortcut: '4' },
  { id: 'clients', label: 'Clients', icon: BriefcaseBusiness, shortcut: '5' },
  { id: 'reports', label: 'Reports', icon: BarChart3, shortcut: '6' },
  { id: 'invoices', label: 'Invoices', icon: FileText, shortcut: '7' },
  { id: 'settings', label: 'Settings', icon: Settings2, shortcut: '8' },
];

export function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {tabItems.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <Tooltip
            key={t.id}
            side="right"
            content={
              <span className="flex items-center gap-1.5">
                <span>{t.label}</span>
                <span className="font-mono text-[10px] opacity-70">⌘{t.shortcut}</span>
              </span>
            }
          >
            <button
              type="button"
              onClick={() => onChange(t.id)}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'titlebar-no-drag group relative flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors',
                'max-md:h-10 max-md:justify-center max-md:gap-0 max-md:px-0',
                active
                  ? 'bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-zinc-900 transition-all dark:bg-zinc-100',
                  active ? 'h-4 w-[2px] opacity-100' : 'h-2 w-[2px] opacity-0',
                  'max-md:h-5',
                )}
              />
              <Icon
                strokeWidth={active ? 2.25 : 2}
                className={cn(
                  'h-4 w-4 shrink-0 transition-[transform,color]',
                  'max-md:h-[18px] max-md:w-[18px]',
                  active
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100',
                )}
              />
              <span className="flex-1 truncate font-medium max-md:hidden">{t.label}</span>
              <Kbd
                className={cn(
                  'opacity-0 transition-opacity group-hover:opacity-100 max-md:hidden',
                  active && 'opacity-100',
                )}
              >
                ⌘{t.shortcut}
              </Kbd>
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}

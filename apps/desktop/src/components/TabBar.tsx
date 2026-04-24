import { cn, Kbd } from '@ttf/ui';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  FolderKanban,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export type Tab = 'day' | 'projects' | 'clients' | 'reports' | 'invoices' | 'settings';

export const tabItems: Array<{
  id: Tab;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}> = [
  { id: 'day', label: 'Today', icon: CalendarDays, shortcut: '1' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, shortcut: '2' },
  { id: 'clients', label: 'Clients', icon: BriefcaseBusiness, shortcut: '3' },
  { id: 'reports', label: 'Reports', icon: BarChart3, shortcut: '4' },
  { id: 'invoices', label: 'Invoices', icon: FileText, shortcut: '5' },
  { id: 'settings', label: 'Settings', icon: Settings2, shortcut: '6' },
];

export function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {tabItems.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            title={`${t.label} (⌘${t.shortcut})`}
            className={cn(
              'titlebar-no-drag group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors max-md:h-9 max-md:justify-center max-md:px-0',
              active
                ? 'bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
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
        );
      })}
    </nav>
  );
}

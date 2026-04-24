import type { ComponentType, ReactNode } from 'react';
import { cn } from '../cn';

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800',
        className,
      )}
    >
      {Icon && (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="space-y-1">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
        {description && (
          <p className="mx-auto max-w-xs text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function Section({
  title,
  description,
  action,
  className,
  children,
  ...rest
}: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-3', className)} {...rest}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

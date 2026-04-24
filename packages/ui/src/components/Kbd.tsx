import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[1.25rem] items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
        className,
      )}
      {...rest}
    />
  );
}

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../cn';

/**
 * Native <select> kept for non-critical paths (currency lists in forms).
 * For the primary navigation/picker UX, prefer the Combobox component.
 */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'titlebar-no-drag h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 transition-colors focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/10 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-100/10',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

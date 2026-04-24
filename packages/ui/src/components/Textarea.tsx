import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'titlebar-no-drag w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm leading-relaxed text-zinc-900 transition-colors placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-100/10',
        className,
      )}
      {...rest}
    />
  );
});

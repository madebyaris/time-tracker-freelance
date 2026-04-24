import type { HTMLAttributes, LabelHTMLAttributes } from 'react';
import { cn } from '../cn';

export function Field({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...rest} />;
}

export function FieldLabel({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400',
        className,
      )}
      {...rest}
    />
  );
}

export function FieldHint({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-zinc-500 dark:text-zinc-400', className)} {...rest} />;
}

export function FieldRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-end gap-3', className)} {...rest} />;
}

import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  hint?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<SegmentedOption<T>>;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const height = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.hint}
            className={cn(
              'titlebar-no-drag inline-flex min-w-[2.25rem] items-center justify-center gap-1 rounded-[5px] px-2.5 font-medium transition-colors',
              height,
              active
                ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-zinc-950 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

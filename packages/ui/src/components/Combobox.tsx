import { useMemo, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../cn';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
  color?: string | null;
  /** Optional group key. When any option has a group, options are rendered
   *  under section headers in the order they first appear. */
  group?: string;
  /** Optional initial(s) shown in a square avatar instead of a color dot.
   *  Useful for clients (e.g. "BL"). */
  initials?: string;
}

export interface ComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  contentClassName?: string;
  size?: 'sm' | 'md';
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  allowClear?: boolean;
  leading?: ReactNode;
  footer?: ReactNode;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyLabel = 'Nothing found',
  searchPlaceholder = 'Search…',
  triggerClassName,
  contentClassName,
  size = 'md',
  align = 'start',
  side = 'bottom',
  disabled,
  allowClear = true,
  leading,
  footer,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        (option.hint?.toLowerCase().includes(q) ?? false) ||
        (option.group?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  // Group filtered options preserving first-seen order.
  const grouped = useMemo(() => {
    const hasGroups = options.some((option) => option.group);
    if (!hasGroups) return [{ key: '__none__', label: '', items: filtered }] as const;
    const order: string[] = [];
    const map = new Map<string, ComboboxOption[]>();
    for (const option of filtered) {
      const key = option.group ?? '';
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(option);
    }
    return order.map((key) => ({ key, label: key, items: map.get(key)! }));
  }, [filtered, options]);

  const triggerHeight = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'titlebar-no-drag inline-flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 text-left text-zinc-900 transition-colors hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:focus-visible:ring-zinc-100/10',
            triggerHeight,
            triggerClassName,
          )}
        >
          {leading}
          {selected?.color && !selected.initials && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
          )}
          {selected?.initials && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-zinc-200 text-[9px] font-semibold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {selected.initials}
            </span>
          )}
          <span className={cn('flex-1 truncate', !selected && 'text-zinc-400 dark:text-zinc-500')}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.group && (
            <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 sm:inline">
              {selected.group}
            </span>
          )}
          <span className="text-zinc-400 dark:text-zinc-500">⌄</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 w-[--radix-popover-trigger-width] min-w-[200px] overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]',
            contentClassName,
          )}
        >
          <div className="px-1.5 pb-1 pt-1">
            <input
              autoFocus
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-7 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:bg-white focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-zinc-600 dark:focus-visible:bg-zinc-900"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                  !value && 'text-zinc-900 dark:text-zinc-100',
                )}
              >
                <span className="flex-1">No selection</span>
                {!value && <span className="text-[11px] uppercase tracking-wide">current</span>}
              </button>
            )}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {emptyLabel}
              </div>
            )}
            {grouped.map((section) => (
              <div key={section.key}>
                {section.label && (
                  <div className="mt-1 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 first:mt-0 first:pt-1">
                    {section.label}
                  </div>
                )}
                {section.items.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
                        active
                          ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50'
                          : 'text-zinc-700 dark:text-zinc-200',
                      )}
                    >
                      {option.color && !option.initials && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      {option.initials && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-[10px] font-semibold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          {option.initials}
                        </span>
                      )}
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.hint && (
                        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          {option.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {footer && (
            <div className="border-t border-zinc-100 px-1.5 py-1 dark:border-zinc-800">{footer}</div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

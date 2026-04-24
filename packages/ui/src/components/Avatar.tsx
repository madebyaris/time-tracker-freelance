import { cn } from '../cn';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 16 | 20 | 24 | 32 | 40 | 48 | 64;
  rounded?: 'md' | 'full';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  16: 'h-[16px] w-[16px]',
  20: 'h-[20px] w-[20px]',
  24: 'h-[24px] w-[24px]',
  32: 'h-8 w-8',
  40: 'h-10 w-10',
  48: 'h-12 w-12',
  64: 'h-16 w-16',
};

const TEXT_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  16: 'text-[9px]',
  20: 'text-[10px]',
  24: 'text-[11px]',
  32: 'text-xs',
  40: 'text-sm',
  48: 'text-base',
  64: 'text-lg',
};

// Stable, light/dark-friendly tints. Each pair: bg + text color.
const PALETTE: Array<{ bg: string; text: string }> = [
  { bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-700 dark:text-zinc-100' },
  { bg: 'bg-indigo-200 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-100' },
  { bg: 'bg-emerald-200 dark:bg-emerald-900', text: 'text-emerald-800 dark:text-emerald-100' },
  { bg: 'bg-amber-200 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-100' },
  { bg: 'bg-rose-200 dark:bg-rose-900', text: 'text-rose-800 dark:text-rose-100' },
  { bg: 'bg-sky-200 dark:bg-sky-900', text: 'text-sky-800 dark:text-sky-100' },
  { bg: 'bg-violet-200 dark:bg-violet-900', text: 'text-violet-800 dark:text-violet-100' },
  { bg: 'bg-teal-200 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-100' },
];

function hashString(input: string): number {
  // djb2 — small, stable, deterministic across runs.
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  return trimmed.slice(0, 2).toUpperCase();
}

export function Avatar({ src, name, size = 32, rounded = 'full', className }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const textClass = TEXT_CLASSES[size];
  const radiusClass = rounded === 'full' ? 'rounded-full' : 'rounded-md';

  if (src && src.length > 0) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={cn(
          'shrink-0 object-cover',
          sizeClass,
          radiusClass,
          className,
        )}
      />
    );
  }

  const palette = PALETTE[hashString(name) % PALETTE.length]!;

  return (
    <span
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold uppercase leading-none',
        sizeClass,
        textClass,
        radiusClass,
        palette.bg,
        palette.text,
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}

import type { ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../cn';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Delay in ms before the tooltip appears. Default 200. */
  delayDuration?: number;
  /** Render the tooltip in a portal. Default true. */
  asChild?: boolean;
  className?: string;
}

/**
 * Lightweight Radix-backed tooltip. Wrap your app once with `TooltipProvider`
 * to enable shared open/close timing, then use this component for individual
 * triggers.
 */
export function Tooltip({
  content,
  children,
  side = 'right',
  align = 'center',
  delayDuration = 200,
  asChild = true,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild={asChild}>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'pointer-events-none z-50 select-none rounded-md bg-zinc-950 px-2 py-1 text-[11px] font-medium text-zinc-50 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 dark:bg-zinc-100 dark:text-zinc-950',
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

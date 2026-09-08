'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils/cn';

export interface CanvasPagerProps {
  readonly index: number;
  readonly count: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

/**
 * Where the pager is mounted.
 *
 * `dock` is the normal form: paging is a global control of the whole deck, so it
 * lives in the edit dock's global edit bar alongside the other course-level
 * entries rather than floating over the page it is about to leave.
 *
 * `floating` is the fallback for scene types that get no dock at all (no
 * narration timeline ⇒ no bench to hang tools off — see
 * `components/edit/scene-timeline.ts`). Without it those scenes would lose
 * paging entirely.
 */
export type CanvasPagerVariant = 'dock' | 'floating';

/** Scene navigation — in the dock's global edit bar, or floating when there is no dock. */
export function CanvasPager({
  index,
  count,
  canPrev,
  canNext,
  onPrev,
  onNext,
  variant = 'floating',
}: CanvasPagerProps & { readonly variant?: CanvasPagerVariant }) {
  const { t } = useI18n();
  if (count <= 0) return null;

  const controls = (
    <>
      <PagerButton
        label={t('edit.nav.prevPage')}
        disabled={!canPrev}
        onClick={onPrev}
        tone={variant}
      >
        <ChevronLeft className="size-4" />
      </PagerButton>
      <span
        className={cn(
          'select-none px-1 text-center font-mono tabular-nums',
          variant === 'dock'
            ? 'min-w-10 text-[11px] text-muted-foreground/70'
            : 'min-w-11 text-[11px] text-zinc-500 dark:text-zinc-400',
        )}
      >
        {index + 1} / {count}
      </span>
      <PagerButton
        label={t('edit.nav.nextPage')}
        disabled={!canNext}
        onClick={onNext}
        tone={variant}
      >
        <ChevronRight className="size-4" />
      </PagerButton>
    </>
  );

  // In the dock the strip supplies the surface (border, blur, height), so the
  // pager is flat controls — a second pill inside the bench would read as a
  // floating thing that happens to be parked there.
  if (variant === 'dock') {
    return (
      <div data-testid="edit-canvas-pager" className="flex shrink-0 items-center">
        {controls}
      </div>
    );
  }

  return (
    <div
      data-testid="edit-canvas-pager"
      className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-primary/20 bg-card/80 p-1 shadow-[0_14px_34px_-20px_color-mix(in_oklab,var(--primary)_60%,transparent)] backdrop-blur-xl dark:border-primary/25 dark:bg-card/75"
    >
      {controls}
    </div>
  );
}

function PagerButton({
  label,
  children,
  tone,
  ...props
}: React.ComponentProps<typeof Button> & {
  readonly label: string;
  /** Named `tone` rather than `variant` so it cannot collide with Button's own. */
  readonly tone: CanvasPagerVariant;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          className={cn(
            'size-7 shrink-0 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-30',
            tone === 'dock'
              ? 'rounded-md text-muted-foreground/60 hover:bg-primary/10 hover:text-primary'
              : 'rounded-full text-zinc-600 hover:bg-primary/10 hover:text-primary dark:text-zinc-300 dark:hover:bg-primary/15 dark:hover:text-primary',
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

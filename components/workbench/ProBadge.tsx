'use client';

/**
 * The Pro badge — the switch into the workbench, worn on the wordmark's
 * shoulder like a trademark. `role="switch"` rather than a button, because it
 * has an on state that outlives the click.
 *
 * Ported from the spike's `ProBadge` (S9): it states the mode of the whole
 * page, which is exactly what a badge on the logo does and what a chip in a
 * toolbar cannot. Small, hairline, silent when off.
 */
import { motion, useReducedMotion } from 'motion/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils/cn';
import './pro-swap.css';

export interface ProBadgeProps {
  active: boolean;
  onToggle?: () => void;
  className?: string;
  /**
   * Override the default `pro-mode-exit` / `pro-mode-enter` testid.
   *
   * The workspace hero wears its own interactive badge while the rail keeps
   * the persistent switch. A distinct id keeps both controls addressable.
   */
  testId?: string;
}

export function ProBadge({ active, onToggle, className, testId }: ProBadgeProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const interactive = !!onToggle;

  const badge = (
    <motion.button
      type="button"
      role={interactive ? 'switch' : undefined}
      aria-checked={interactive ? active : undefined}
      aria-label={t('proMode.badgeAria')}
      data-testid={testId ?? (active ? 'pro-mode-exit' : 'pro-mode-enter')}
      data-pro-badge={active ? 'on' : 'off'}
      disabled={!interactive}
      onClick={onToggle}
      whileTap={reduceMotion || !interactive ? undefined : { scale: 0.94 }}
      className={cn(
        'relative inline-flex select-none items-center whitespace-nowrap rounded-full border',
        'px-2 py-[3px] text-[10px] font-semibold leading-[1.3]',
        'tracking-[0.04em] transition-[color,background-color,border-color,box-shadow] duration-300',
        interactive ? 'cursor-pointer' : 'cursor-default',
        active
          ? [
              'border-primary/70 bg-primary text-primary-foreground',
              'shadow-[0_0_0_3px_rgba(20,169,154,0.14),0_1px_6px_rgba(23,107,135,0.3)]',
            ]
          : [
              'border-border bg-background/70 text-muted-foreground',
              'hover:border-primary/70 hover:bg-accent hover:text-primary',
            ],
        className,
      )}
    >
      <span>{t('proMode.badgeAria')}</span>
    </motion.button>
  );

  if (!interactive) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {active ? t('proMode.badgeExit') : t('proMode.badgeEnter')}
      </TooltipContent>
    </Tooltip>
  );
}

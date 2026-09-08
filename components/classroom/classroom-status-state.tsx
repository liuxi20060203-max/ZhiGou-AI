'use client';

import Link from 'next/link';
import { AlertCircle, FileQuestion, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrand } from '@/lib/brand/brand-context';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

type ClassroomStatusVariant = 'loading' | 'error' | 'not-found';

interface ClassroomStatusStateProps {
  readonly variant: ClassroomStatusVariant;
  readonly message?: string;
  readonly onRetry?: () => void;
}

/** Shared classroom load state for both the standalone route and workspace pane. */
export function ClassroomStatusState({ variant, message, onRetry }: ClassroomStatusStateProps) {
  const { t, locale } = useI18n();
  const brand = useBrand();
  const loading = variant === 'loading';
  const error = variant === 'error';

  const title = loading
    ? t('common.loadingClassroom')
    : error
      ? locale === 'zh-CN'
        ? '课堂加载失败'
        : 'Unable to load classroom'
      : t('classroom.notFound');

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background p-4"
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
      aria-busy={loading || undefined}
      data-testid={variant === 'not-found' ? 'classroom-not-found' : undefined}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0',
          error
            ? 'bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--destructive)_9%,transparent),transparent_45%)]'
            : 'bg-[radial-gradient(circle_at_50%_38%,color-mix(in_oklab,var(--primary)_13%,transparent),transparent_45%)]',
        )}
      />
      <div className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-[28px] border border-primary/15 bg-[linear-gradient(145deg,color-mix(in_oklab,var(--card)_96%,var(--primary)_4%),var(--card))] px-8 py-10 text-center shadow-[0_30px_80px_-48px_color-mix(in_oklab,var(--primary)_58%,transparent)] backdrop-blur-xl dark:border-primary/20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent"
        />
        <img src={brand.logoSrc} alt={brand.productName} className="h-8 w-auto dark:hidden" />
        <img
          src={brand.darkLogoSrc}
          alt={brand.productName}
          className="hidden h-8 w-auto dark:block"
        />

        <span
          className={cn(
            'mt-8 flex size-16 items-center justify-center rounded-2xl border',
            error
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'border-primary/20 bg-primary/10 text-primary',
          )}
        >
          {loading ? (
            <Loader2 className="size-7 animate-spin" aria-hidden="true" />
          ) : error ? (
            <AlertCircle className="size-7" aria-hidden="true" />
          ) : (
            <FileQuestion className="size-7" aria-hidden="true" />
          )}
        </span>

        <h1 className={cn('mt-5 font-semibold text-foreground', loading ? 'text-base' : 'text-xl')}>
          {title}
        </h1>

        {!loading && (
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {error ? message : t('classroom.notFoundDesc')}
          </p>
        )}

        {error && onRetry && (
          <Button onClick={onRetry} className="mt-7 w-full sm:w-auto sm:min-w-40">
            <RotateCcw className="mr-2 size-4" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        )}

        {variant === 'not-found' && (
          <Button asChild className="mt-7 w-full sm:w-auto sm:min-w-40">
            <Link href="/">{t('classroom.backToHome')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

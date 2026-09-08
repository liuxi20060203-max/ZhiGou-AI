'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';

const statusIconClassName = 'flex size-8 items-center justify-center rounded-xl border shadow-sm';

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: (
          <span
            className={`${statusIconClassName} border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}
          >
            <CircleCheckIcon className="size-4" />
          </span>
        ),
        info: (
          <span className={`${statusIconClassName} border-primary/25 bg-primary/10 text-primary`}>
            <InfoIcon className="size-4" />
          </span>
        ),
        warning: (
          <span
            className={`${statusIconClassName} border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400`}
          >
            <TriangleAlertIcon className="size-4" />
          </span>
        ),
        error: (
          <span
            className={`${statusIconClassName} border-destructive/25 bg-destructive/10 text-destructive`}
          >
            <OctagonXIcon className="size-4" />
          </span>
        ),
        loading: (
          <span className={`${statusIconClassName} border-primary/25 bg-primary/10 text-primary`}>
            <Loader2Icon className="size-4 animate-spin" />
          </span>
        ),
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'color-mix(in srgb, var(--primary) 22%, var(--border))',
          '--border-radius': '1rem',
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            'cn-toast !min-h-16 !gap-3 !border !bg-popover/95 !p-4 !pr-5 !shadow-[0_18px_50px_-22px_color-mix(in_srgb,var(--primary)_55%,transparent)] backdrop-blur-xl',
          content: '!gap-1',
          title: '!text-sm !font-semibold !tracking-tight',
          description: '!text-xs !leading-5 !text-muted-foreground',
          icon: '!m-0 !size-8 !shrink-0 !overflow-visible',
          actionButton:
            '!h-8 !rounded-lg !bg-primary !px-3 !font-medium !text-primary-foreground transition-opacity hover:!opacity-90',
          cancelButton:
            '!h-8 !rounded-lg !bg-muted !px-3 !font-medium !text-muted-foreground transition-colors hover:!text-foreground',
          closeButton:
            '!border-border !bg-popover !text-muted-foreground hover:!border-primary/30 hover:!bg-accent hover:!text-primary',
          success: '!border-emerald-500/30',
          info: '!border-primary/35',
          warning: '!border-amber-500/30',
          error: '!border-destructive/35',
          loading: '!border-primary/35',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StageMode } from '@/lib/types/stage';
import { classroomExitLabelKey, exitClassroom } from '@/lib/workbench/classroom-exit';
import { HeaderControls } from './stage/header-controls';
import { useBrand } from '@/lib/brand/brand-context';
import { useTheme } from '@/lib/hooks/use-theme';
import { useStageStore } from '@/lib/store';
import classroomShellStyles from '@/components/classroom/classroom-shell.module.css';

interface HeaderProps {
  readonly currentSceneTitle: string;
  readonly currentSceneIndex?: number;
  readonly scenesCount?: number;
  readonly mode?: StageMode;
  readonly proModeActive?: boolean;
  readonly canEdit?: boolean;
  readonly onToggleEditMode?: () => void;
  /** Replaces the default back-to-home arrow as the header's leftmost
      control. `PlaybackChromeRoot` passes the workbench's return control
      here while a session is attached and full-screen playback is on, so the
      top-left back affordance becomes the back-to-workspace control instead of a home arrow
      (which would navigate away from the hosted classroom entirely). */
  readonly backControl?: ReactNode;
  /** Drops the back slot entirely (no `backControl`, no home arrow). The
      embedded workbench form uses this: the conversation sits beside/above
      the classroom, so any back affordance here would duplicate the chat's
      own back and could exit the workbench. */
  readonly hideBackControl?: boolean;
  /** Hide application-global controls in a workbench-attached classroom. */
  readonly hideGlobalControls?: boolean;
  /** Hide course-level share/export in a workbench-attached classroom. */
  readonly hideCourseActions?: boolean;
}

export function Header({
  currentSceneTitle,
  currentSceneIndex = -1,
  scenesCount = 0,
  mode,
  proModeActive,
  canEdit,
  onToggleEditMode,
  backControl,
  hideBackControl,
  hideGlobalControls,
  hideCourseActions,
}: HeaderProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const exitLabel = t(classroomExitLabelKey(searchParams));
  const brand = useBrand();
  const { resolvedTheme } = useTheme();
  const stageName = useStageStore((state) => state.stage?.name);
  const currentBlockNumber = currentSceneIndex >= 0 ? currentSceneIndex + 1 : 0;
  const blockProgressLabel =
    locale === 'zh-CN'
      ? `知识构件 ${currentBlockNumber.toString().padStart(2, '0')} / ${scenesCount
          .toString()
          .padStart(2, '0')}`
      : `Knowledge block ${currentBlockNumber.toString().padStart(2, '0')} / ${scenesCount
          .toString()
          .padStart(2, '0')}`;

  return (
    <>
      <header
        data-testid="classroom-identity-bar"
        className={`${classroomShellStyles.identityBar} z-10 flex h-16 items-center justify-between gap-2 px-2 sm:gap-4 sm:px-5 md:px-7`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {hideBackControl
            ? null
            : (backControl ?? (
                <button
                  onClick={() => exitClassroom(router, searchParams)}
                  className="shrink-0 rounded-xl border border-border/70 bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-primary"
                  title={exitLabel}
                  aria-label={exitLabel}
                >
                  <ArrowLeft className="size-5" />
                </button>
              ))}
          {!hideBackControl && (
            <>
              <img
                src={resolvedTheme === 'dark' ? brand.darkLogoSrc : brand.logoSrc}
                alt={brand.productName}
                className="hidden h-6 w-auto sm:block"
              />
              <div className="hidden h-6 w-px bg-border/80 sm:block" />
            </>
          )}
          {/* Title block — hidden when `mode === 'edit'`. Header lives
              inside `PlaybackChromeRoot`, which is unmounted by `Stage`
              once mode flips to 'edit', so in steady state this branch
              is always taken. The guard exists for the ~280ms
              AnimatePresence exit window where the playback chrome
              is still rendering its exit animation while `mode` has
              already flipped — without the guard, this title would
              briefly stack on top of the incoming EditChromeRoot's
              CommandBar title during the cross-fade. */}
          {mode !== 'edit' && (
            <div className="flex min-w-0 flex-col justify-center">
              <span className="mb-0.5 hidden truncate text-[10px] font-semibold uppercase tracking-[0.15em] text-primary sm:block">
                {stageName || t('stage.currentScene')}
              </span>
              <h1
                className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base md:text-lg"
                suppressHydrationWarning
              >
                {currentSceneTitle || t('common.loading')}
              </h1>
            </div>
          )}
          {mode !== 'edit' && scenesCount > 0 && (
            <div
              data-testid="classroom-block-progress"
              className="ml-1 hidden shrink-0 items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-primary lg:flex"
              aria-label={blockProgressLabel}
            >
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_12%,transparent)]" />
              <span className="tabular-nums">{blockProgressLabel}</span>
            </div>
          )}
        </div>

        {/* Standalone classroom keeps the full cluster. Workbench-attached
            classrooms omit both the global capsule and course share/export. */}
        <HeaderControls
          mode={mode}
          proModeActive={proModeActive}
          canEdit={canEdit}
          onToggleEditMode={onToggleEditMode}
          showGlobalControls={!hideGlobalControls}
          showCourseActions={!hideCourseActions}
        />
      </header>
    </>
  );
}

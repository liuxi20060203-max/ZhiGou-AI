'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PieChart,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { RepairPanel } from '@/components/learning-loop/repair-panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isLearningLoopEnabled } from '@/lib/config/feature-flags';
import { useNearViewport } from '@/lib/hooks/use-near-viewport';
import { useI18n } from '@/lib/hooks/use-i18n';
import { learnerConfusionEvidence, sceneVisitedEvidence } from '@/lib/learning-loop/evidence';
import { trackLearningLoopEvent } from '@/lib/learning-loop/analytics';
import { foldComponentLearningState } from '@/lib/learning-loop/fold';
import { buildKnowledgeModel } from '@/lib/learning-loop/knowledge-model';
import { appendLearningEvidence, notifyLearningJourneyChanged } from '@/lib/learning-loop/runtime';
import type { ComponentLearningState } from '@/lib/learning-loop/fold';
import type { KnowledgeComponent, LearningComponentStatus } from '@/lib/learning-loop/types';
import { useLearningJourney } from '@/lib/learning-loop/use-learning-journey';
import { useCanvasStore, useStageStore } from '@/lib/store';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import type { SceneType, SlideContent } from '@/lib/types/stage';
import { cn } from '@/lib/utils';
import classroomShellStyles from '@/components/classroom/classroom-shell.module.css';

interface KnowledgePathSidebarProps {
  readonly collapsed: boolean;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
  readonly isCourseComplete?: boolean;
}

const DEFAULT_WIDTH = 248;
const COLLAPSED_WIDTH = 52;
const MIN_WIDTH = 220;
const MAX_WIDTH = 320;

const SCENE_ICONS = {
  slide: BookOpen,
  quiz: PieChart,
  interactive: MousePointer2,
  pbl: Cpu,
} satisfies Partial<Record<SceneType, typeof BookOpen>>;

export function KnowledgePathSidebar({
  collapsed,
  onCollapseChange,
  onSceneSelect,
  onRetryOutline,
  isCourseComplete,
}: KnowledgePathSidebarProps) {
  const { t, locale } = useI18n();
  const {
    stage,
    scenes,
    outlines,
    currentSceneId,
    setCurrentSceneId,
    generatingOutlines,
    generationStatus,
  } = useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();
  const activeNodeRef = useRef<HTMLButtonElement>(null);
  const isDraggingRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [showPreviews, setShowPreviews] = useState(false);
  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);
  const isChinese = locale === 'zh-CN';
  const learningLoopEnabled = isLearningLoopEnabled();
  const knowledgeModel = useMemo(
    () => (learningLoopEnabled ? buildKnowledgeModel(stage, scenes, outlines) : null),
    [learningLoopEnabled, outlines, scenes, stage],
  );
  const componentBySceneId = useMemo(
    () =>
      new Map(
        (knowledgeModel?.components ?? []).flatMap((component) =>
          component.sceneIds.map((sceneId) => [sceneId, component] as const),
        ),
      ),
    [knowledgeModel],
  );
  const {
    evidence,
    error: evidenceReadError,
    refresh: refreshEvidence,
  } = useLearningJourney(stage?.id, learningLoopEnabled);
  const [evidenceWriteFailed, setEvidenceWriteFailed] = useState(false);
  const [repairComponent, setRepairComponent] = useState<KnowledgeComponent>();
  const learningStateByComponentId = useMemo(
    () =>
      new Map(
        (knowledgeModel?.components ?? []).map((component) => {
          const state = foldComponentLearningState(component, evidence);
          return [component.id, state] as const;
        }),
      ),
    [evidence, knowledgeModel],
  );
  const currentSceneIndex = scenes.findIndex((scene) => scene.id === currentSceneId);

  useEffect(() => {
    if (!learningLoopEnabled || !stage?.id || !currentSceneId) return;
    const component = componentBySceneId.get(currentSceneId);
    if (!component) return;
    const occurredAt = new Date().toISOString();
    void appendLearningEvidence(
      stage.id,
      sceneVisitedEvidence({
        stageId: stage.id,
        sceneId: currentSceneId,
        componentId: component.id,
        occurredAt,
      }),
    )
      .then(() => {
        setEvidenceWriteFailed(false);
        trackLearningLoopEvent({
          name: 'learning_loop_component_viewed',
          stageId: stage.id,
          componentId: component.id,
        });
        notifyLearningJourneyChanged(stage.id);
      })
      .catch(() => setEvidenceWriteFailed(true));
  }, [componentBySceneId, currentSceneId, learningLoopEnabled, stage?.id]);

  const markConfusion = useCallback(
    async (component: KnowledgeComponent) => {
      if (!stage?.id) return;
      const sceneId = component.sceneIds[0];
      if (!sceneId) return;
      const occurredAt = new Date().toISOString();
      const randomPart =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      try {
        await appendLearningEvidence(
          stage.id,
          learnerConfusionEvidence({
            eventId: `confusion:${component.id}:${randomPart}`,
            sceneId,
            componentId: component.id,
            occurredAt,
          }),
        );
        setEvidenceWriteFailed(false);
        notifyLearningJourneyChanged(stage.id);
        await refreshEvidence();
        setRepairComponent(component);
      } catch {
        setEvidenceWriteFailed(true);
      }
    },
    [refreshEvidence, stage?.id],
  );

  useEffect(() => {
    activeNodeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentSceneId, collapsed]);

  const selectScene = (sceneId: string) => {
    if (onSceneSelect) onSceneSelect(sceneId);
    else setCurrentSceneId(sceneId);
  };

  const handleRetryOutline = async (outlineId: string) => {
    if (!onRetryOutline) return;
    setRetryingOutlineId(outlineId);
    try {
      await onRetryOutline(outlineId);
    } finally {
      setRetryingOutlineId(null);
    }
  };

  const handleDragStart = useCallback(
    (event: React.MouseEvent) => {
      if (collapsed) return;
      event.preventDefault();
      isDraggingRef.current = true;
      const startX = event.clientX;
      const startWidth = sidebarWidth;
      const handleMouseMove = (moveEvent: MouseEvent) => {
        setSidebarWidth(
          Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startX)),
        );
      };
      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [collapsed, sidebarWidth],
  );

  const typeLabel = (type: SceneType) => {
    const labels = isChinese
      ? { slide: '课程讲解', quiz: '理解检测', interactive: '互动探索', pbl: '项目实践' }
      : { slide: 'Lesson', quiz: 'Check', interactive: 'Explore', pbl: 'Project' };
    return labels[type as keyof typeof labels] ?? labels.slide;
  };

  const collapseLabel = collapsed
    ? isChinese
      ? '展开知识路径'
      : 'Expand knowledge path'
    : isChinese
      ? '收起知识路径'
      : 'Collapse knowledge path';

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        data-testid="knowledge-path"
        data-collapsed={collapsed}
        aria-label={isChinese ? '知识路径' : 'Knowledge path'}
        style={{
          width: collapsed ? COLLAPSED_WIDTH : sidebarWidth,
          transition: isDraggingRef.current ? 'none' : 'width 220ms ease',
        }}
        className={cn(
          classroomShellStyles.knowledgePath,
          'relative z-20 flex shrink-0 flex-col overflow-visible',
          collapsed && classroomShellStyles.knowledgePathCollapsed,
        )}
      >
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="group absolute inset-y-0 right-0 z-50 w-1.5 cursor-col-resize transition-colors hover:bg-primary/15"
            aria-hidden="true"
          >
            <div className="absolute right-0.5 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary" />
          </div>
        )}

        <div
          className={cn(
            classroomShellStyles.knowledgePathHeader,
            'flex h-20 shrink-0 items-center justify-between border-b border-[color:var(--classroom-line)] px-3',
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                {isChinese ? '知识路径' : 'Knowledge path'}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-foreground">
                  {isChinese ? '构件脉络' : 'Learning sequence'}
                </h2>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                  {scenes.length}
                </span>
              </div>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onCollapseChange(!collapsed)}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/75 text-muted-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-primary',
                  collapsed && 'mx-auto',
                )}
                aria-label={collapseLabel}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapseLabel}</TooltipContent>
          </Tooltip>
        </div>

        {!collapsed && (
          <div
            className={cn(
              classroomShellStyles.knowledgePathGuide,
              'flex h-10 shrink-0 items-center justify-between border-b border-border/50 px-3',
            )}
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              {isChinese ? '沿路径逐步构建理解' : 'Build understanding step by step'}
            </span>
            <button
              type="button"
              onClick={() => setShowPreviews((visible) => !visible)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              aria-pressed={showPreviews}
              aria-label={
                showPreviews
                  ? isChinese
                    ? '隐藏构件预览'
                    : 'Hide previews'
                  : isChinese
                    ? '显示构件预览'
                    : 'Show previews'
              }
            >
              {showPreviews ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        )}

        <div
          data-testid="scene-list"
          className={cn(
            classroomShellStyles.knowledgePathList,
            'scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3',
            collapsed ? 'px-1.5' : 'px-3',
          )}
        >
          <div className={cn(classroomShellStyles.knowledgePathTrack, 'relative')}>
            <div
              className={cn(
                classroomShellStyles.knowledgePathLine,
                collapsed ? 'left-[19px]' : 'left-[17px]',
              )}
              aria-hidden="true"
            />
            <div className={cn(classroomShellStyles.knowledgePathNodes, 'space-y-1.5')}>
              {scenes.map((scene, index) => {
                const isActive = currentSceneId === scene.id;
                const isVisited = currentSceneIndex >= 0 && index < currentSceneIndex;
                const knowledgeComponent = componentBySceneId.get(scene.id);
                const learningState = knowledgeComponent
                  ? learningStateByComponentId.get(knowledgeComponent.id)
                  : undefined;
                const Icon = SCENE_ICONS[scene.type] ?? BookOpen;
                const status = learningState
                  ? learningStatusLabel(learningState.status, isChinese)
                  : isActive
                    ? isChinese
                      ? '构建中'
                      : 'Building'
                    : isVisited
                      ? isChinese
                        ? '已浏览'
                        : 'Visited'
                      : isChinese
                        ? '待探索'
                        : 'To explore';
                const sceneNode = (
                  <button
                    key={scene.id}
                    ref={isActive ? activeNodeRef : undefined}
                    type="button"
                    data-testid="scene-item"
                    data-knowledge-component-id={knowledgeComponent?.id}
                    data-knowledge-component-source={knowledgeComponent?.source}
                    data-learning-status={learningState?.status}
                    data-scene-state={isActive ? 'current' : isVisited ? 'visited' : 'upcoming'}
                    onClick={() => selectScene(scene.id)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`${index + 1}. ${scene.title}, ${typeLabel(scene.type)}, ${status}`}
                    className={cn(
                      classroomShellStyles.knowledgeNode,
                      'group relative flex w-full text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/50',
                      collapsed
                        ? 'h-10 items-center justify-center rounded-xl'
                        : 'min-h-[68px] gap-3 rounded-2xl py-2.5 pl-1.5 pr-2',
                      learningLoopEnabled && !collapsed && 'pr-10',
                      isActive
                        ? classroomShellStyles.knowledgeNodeActive
                        : 'hover:bg-background/65',
                    )}
                  >
                    <span
                      className={cn(
                        classroomShellStyles.knowledgeNodeDot,
                        'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                        isActive
                          ? 'border-primary bg-background text-primary ring-4 ring-primary/10'
                          : isVisited
                            ? 'border-[color:var(--classroom-success)] bg-[color:var(--classroom-success)] text-white'
                            : 'border-[color:var(--classroom-line)] bg-[color:var(--classroom-surface)] text-muted-foreground',
                      )}
                    >
                      {isVisited ? (
                        <Check className="size-3.5" strokeWidth={2.5} />
                      ) : isActive ? (
                        <span className="size-2 rounded-full bg-primary" />
                      ) : (
                        <span className="text-[9px] font-bold tabular-nums">{index + 1}</span>
                      )}
                    </span>
                    {collapsed && (
                      <span data-testid="scene-title" className="sr-only">
                        {scene.title}
                      </span>
                    )}
                    {!collapsed && (
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            data-testid="scene-title"
                            className={cn(
                              'line-clamp-2 flex-1 text-xs font-semibold leading-4 transition-colors',
                              isActive
                                ? 'text-foreground'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          >
                            {scene.title}
                          </span>
                          <ChevronRight
                            className={cn(
                              'mt-0.5 size-3.5 shrink-0 transition-all',
                              isActive
                                ? 'text-primary opacity-100'
                                : '-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-70',
                            )}
                          />
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                          <Icon className="size-3 text-primary/75" aria-hidden="true" />
                          <span className="text-muted-foreground">{typeLabel(scene.type)}</span>
                          <span className="ml-auto font-medium text-muted-foreground/80">
                            {status}
                          </span>
                        </span>
                        {learningLoopEnabled && knowledgeComponent?.objective && (
                          <span
                            data-testid="knowledge-component-objective"
                            className="mt-1.5 line-clamp-2 block text-[10px] leading-4 text-muted-foreground/80"
                          >
                            {knowledgeComponent.objective}
                          </span>
                        )}
                        {showPreviews && (
                          <span className="mt-2 block aspect-[16/7] overflow-hidden rounded-xl border border-border/70 bg-muted/50">
                            {scene.type === 'slide' ? (
                              <LazySlideThumbnail
                                slide={(scene.content as SlideContent).canvas}
                                sceneId={scene.id}
                                viewportSize={viewportSize}
                                viewportRatio={viewportRatio}
                                size={Math.max(120, sidebarWidth - 52)}
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15 text-primary/70">
                                <Icon className="size-7" strokeWidth={1.5} />
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
                const node =
                  learningLoopEnabled && !collapsed && knowledgeComponent ? (
                    <div key={scene.id} className="relative">
                      {sceneNode}
                      <KnowledgeComponentDetailsButton
                        component={knowledgeComponent}
                        learningState={learningState}
                        isChinese={isChinese}
                        onMarkConfusion={() => markConfusion(knowledgeComponent)}
                        onStartRepair={() => setRepairComponent(knowledgeComponent)}
                        onEvidenceOpened={() => {
                          if (!stage?.id) return;
                          trackLearningLoopEvent({
                            name: 'learning_loop_evidence_opened',
                            stageId: stage.id,
                            componentId: knowledgeComponent.id,
                          });
                          if (learningState?.status === 'needs_revisit') {
                            trackLearningLoopEvent({
                              name: 'learning_loop_repair_suggested',
                              stageId: stage.id,
                              componentId: knowledgeComponent.id,
                            });
                          }
                        }}
                      />
                    </div>
                  ) : (
                    sceneNode
                  );

                return collapsed ? (
                  <Tooltip key={scene.id}>
                    <TooltipTrigger asChild>{node}</TooltipTrigger>
                    <TooltipContent side="right" className="max-w-64">
                      <p className="font-medium">{scene.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {typeLabel(scene.type)} · {status}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  node
                );
              })}

              {generatingOutlines.length > 0 &&
                (() => {
                  const outline = generatingOutlines[0];
                  const failed = failedOutlines.some((item) => item.id === outline.id);
                  const retrying = retryingOutlineId === outline.id;
                  const paused = generationStatus === 'paused';
                  const status = failed
                    ? isChinese
                      ? '需要修复'
                      : 'Needs repair'
                    : paused
                      ? t('stage.paused')
                      : t('stage.generating');
                  return (
                    <PathStatusNode
                      collapsed={collapsed}
                      active={currentSceneId === PENDING_SCENE_ID}
                      title={outline.title}
                      status={status}
                      onClick={
                        failed
                          ? onRetryOutline
                            ? () => void handleRetryOutline(outline.id)
                            : undefined
                          : () => selectScene(PENDING_SCENE_ID)
                      }
                      icon={
                        failed ? (
                          retrying ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <AlertCircle className="size-3.5" />
                          )
                        ) : paused ? (
                          <Pause className="size-3" fill="currentColor" />
                        ) : (
                          <Loader2 className="size-3.5 animate-spin" />
                        )
                      }
                      tone={failed ? 'danger' : paused ? 'muted' : 'active'}
                    />
                  );
                })()}

              {isCourseComplete && generatingOutlines.length === 0 && (
                <PathStatusNode
                  collapsed={collapsed}
                  active={currentSceneId === PENDING_SCENE_ID}
                  title={t('stage.courseComplete')}
                  status={isChinese ? '路径收束' : 'Path complete'}
                  onClick={() => selectScene(PENDING_SCENE_ID)}
                  icon={<Trophy className="size-3.5" />}
                  tone="complete"
                />
              )}
            </div>
          </div>
        </div>
        {learningLoopEnabled && (evidenceReadError || evidenceWriteFailed) && !collapsed && (
          <div
            role="status"
            className="border-t border-amber-200/70 bg-amber-50/80 px-3 py-2 text-[10px] leading-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {isChinese
              ? '学习证据暂未同步，不影响继续学习。'
              : 'Learning evidence is not synced yet. You can keep learning.'}
          </div>
        )}
        {learningLoopEnabled && repairComponent && (
          <RepairPanel
            component={repairComponent}
            evidence={evidence.filter((item) => item.componentId === repairComponent.id)}
            isChinese={isChinese}
            onClose={() => setRepairComponent(undefined)}
          />
        )}
      </aside>
    </TooltipProvider>
  );
}

function KnowledgeComponentDetailsButton({
  component,
  learningState,
  isChinese,
  onMarkConfusion,
  onStartRepair,
  onEvidenceOpened,
}: {
  readonly component: KnowledgeComponent;
  readonly learningState?: ComponentLearningState;
  readonly isChinese: boolean;
  readonly onMarkConfusion: () => Promise<void>;
  readonly onStartRepair: () => void;
  readonly onEvidenceOpened: () => void;
}) {
  return (
    <Popover onOpenChange={(open) => open && onEvidenceOpened()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="knowledge-component-details-trigger"
          className="absolute right-2 top-2.5 z-20 flex size-6 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={
            isChinese ? `查看“${component.title}”构件详情` : `View ${component.title} details`
          }
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        data-testid="knowledge-component-details"
        className="w-72 rounded-2xl p-4"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {isChinese ? '知识构件' : 'Knowledge component'}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">{component.title}</h3>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-[11px]">
          <span className="text-muted-foreground">
            {isChinese ? '理解状态' : 'Understanding status'}
          </span>
          <span className="font-medium text-foreground">
            {learningStatusLabel(learningState?.status ?? 'not_started', isChinese)}
          </span>
        </div>
        {component.objective && (
          <div className="mt-3">
            <p className="text-[10px] font-medium text-muted-foreground">
              {isChinese ? '构建目标' : 'Learning objective'}
            </p>
            <p className="mt-1 text-xs leading-5 text-foreground/85">{component.objective}</p>
          </div>
        )}
        {component.keyPoints.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-medium text-muted-foreground">
              {isChinese ? '关键支点' : 'Key points'}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {component.keyPoints.slice(0, 4).map((point) => (
                <li key={point} className="flex gap-2 text-xs leading-5 text-foreground/80">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/70" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {learningState && learningState.evidence.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-medium text-muted-foreground">
              {isChinese ? '理解证据' : 'Understanding evidence'}
            </p>
            <ul className="mt-1.5 space-y-1.5" data-testid="learning-evidence-list">
              {learningState.evidence.slice(-4).map((item) => (
                <li
                  key={item.eventId}
                  className="rounded-lg bg-muted/40 px-2.5 py-2 text-[11px] text-foreground/80"
                >
                  {evidenceLabel(item.type, item.outcome, isChinese)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() =>
            learningState?.status === 'needs_revisit' ? onStartRepair() : void onMarkConfusion()
          }
          className="mt-3 w-full rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {learningState?.status === 'needs_revisit'
            ? isChinese
              ? '开始补学'
              : 'Start repair path'
            : isChinese
              ? '这里没懂'
              : "I don't understand this yet"}
        </button>
        <p className="mt-3 border-t border-border/60 pt-2 text-[10px] text-muted-foreground/75">
          {component.source === 'outline-derived'
            ? isChinese
              ? '目标与关键点来自课程生成大纲'
              : 'Objective and key points come from the course outline'
            : isChinese
              ? '此构件由当前教学场景安全派生'
              : 'This component is safely derived from the current scene'}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function learningStatusLabel(status: LearningComponentStatus, isChinese: boolean): string {
  const labels: Record<LearningComponentStatus, readonly [string, string]> = {
    not_started: ['未开始', 'Not started'],
    in_progress: ['构建中', 'Building'],
    evidence_available: ['已有证据', 'Evidence available'],
    needs_revisit: ['建议回看', 'Revisit suggested'],
    verified: ['已有验证', 'Verified'],
  };
  return labels[status][isChinese ? 0 : 1];
}

function evidenceLabel(type: string, outcome: string, isChinese: boolean): string {
  if (type === 'scene_visited') return isChinese ? '已进入该知识构件' : 'Component visited';
  if (type === 'learner_confusion') return isChinese ? '你标记了“这里没懂”' : 'Marked as unclear';
  if (type === 'quiz_reviewed') {
    if (outcome === 'supports') return isChinese ? '理解检测回答正确' : 'Quiz answer correct';
    return isChinese ? '理解检测需要回看' : 'Quiz answer needs review';
  }
  if (type === 'verification_passed') return isChinese ? '补学验证通过' : 'Verification passed';
  if (type === 'verification_failed') return isChinese ? '补学验证未通过' : 'Verification failed';
  return isChinese ? '已记录一条学习证据' : 'Learning evidence recorded';
}

function PathStatusNode({
  collapsed,
  active,
  title,
  status,
  onClick,
  icon,
  tone,
}: {
  readonly collapsed: boolean;
  readonly active: boolean;
  readonly title: string;
  readonly status: string;
  readonly onClick?: () => void;
  readonly icon: React.ReactNode;
  readonly tone: 'active' | 'muted' | 'danger' | 'complete';
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-current={active ? 'step' : undefined}
      aria-label={`${title}, ${status}`}
      className={cn(
        classroomShellStyles.knowledgeNode,
        'group relative flex w-full text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-default',
        collapsed
          ? 'h-10 items-center justify-center rounded-xl'
          : 'min-h-[62px] items-center gap-3 rounded-2xl py-2.5 pl-1.5 pr-2',
        active && classroomShellStyles.knowledgeNodeActive,
      )}
    >
      <span
        className={cn(
          'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background',
          tone === 'danger' && 'border-red-300 text-red-500 dark:border-red-800',
          tone === 'active' && 'border-primary text-primary ring-4 ring-primary/10',
          tone === 'muted' && 'border-border text-muted-foreground',
          tone === 'complete' &&
            'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
        )}
      >
        {icon}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="line-clamp-2 flex-1 text-xs font-semibold leading-4 text-foreground">
              {title}
            </span>
          </span>
          <span
            className={cn(
              'mt-1 block text-[10px] font-medium',
              tone === 'danger' ? 'text-red-500' : 'text-muted-foreground',
            )}
          >
            {status}
          </span>
        </span>
      )}
    </button>
  );

  if (!collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">
        <p className="font-medium">{title}</p>
        <p className="text-[10px] text-muted-foreground">{status}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function LazySlideThumbnail({
  slide,
  sceneId,
  viewportSize,
  viewportRatio,
  size,
}: {
  readonly slide: SlideContent['canvas'];
  readonly sceneId: string;
  readonly viewportSize: number;
  readonly viewportRatio: number;
  readonly size: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useNearViewport(ref);
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <SlideThumbnail
        slide={slide}
        sceneId={sceneId}
        viewportSize={viewportSize}
        viewportRatio={viewportRatio}
        size={size}
        visible={visible}
      />
    </div>
  );
}

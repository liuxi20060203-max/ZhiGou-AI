'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNearViewport } from '@/lib/hooks/use-near-viewport';
import { useI18n } from '@/lib/hooks/use-i18n';
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
  const { scenes, currentSceneId, setCurrentSceneId, generatingOutlines, generationStatus } =
    useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();
  const activeNodeRef = useRef<HTMLButtonElement>(null);
  const isDraggingRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [showPreviews, setShowPreviews] = useState(false);
  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);
  const isChinese = locale === 'zh-CN';
  const currentSceneIndex = scenes.findIndex((scene) => scene.id === currentSceneId);

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
                const Icon = SCENE_ICONS[scene.type] ?? BookOpen;
                const status = isActive
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
                const node = (
                  <button
                    key={scene.id}
                    ref={isActive ? activeNodeRef : undefined}
                    type="button"
                    data-testid="scene-item"
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
      </aside>
    </TooltipProvider>
  );
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

'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bookmark, BookOpenCheck, Check, ChevronRight, NotebookPen, Target, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ensureClassroomLearningTask,
  recordVisitedScene,
  saveLearningTaskNote,
  toggleLearningTaskReviewScene,
} from '@/lib/learning/task-storage';
import type { LearningTask } from '@/lib/learning/types';
import { isAutomaticLearningRecord } from '@/lib/learning/task-presentation';
import { getLearningTaskPanelBounds } from '@/lib/learning/panel-layout';
import type { Scene } from '@/lib/types/stage';
import { cn } from '@/lib/utils';

interface LearningTaskPanelProps {
  boundaryRef: RefObject<HTMLDivElement | null>;
  classroomId: string;
  courseName: string;
  scenes: Scene[];
  currentSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}

export function LearningTaskPanel({
  boundaryRef,
  classroomId,
  courseName,
  scenes,
  currentSceneId,
  onSelectScene,
}: LearningTaskPanelProps) {
  const router = useRouter();
  const [task, setTask] = useState<LearningTask | null>(null);
  const [recordError, setRecordError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [noteEdit, setNoteEdit] = useState<{ sceneId: string; content: string; saved: boolean }>();
  const noteDraft =
    noteEdit?.sceneId === currentSceneId
      ? noteEdit.content
      : (task?.notes[currentSceneId ?? '']?.content ?? '');
  const noteSaved = noteEdit?.sceneId === currentSceneId && noteEdit.saved;
  const [panelBounds, setPanelBounds] = useState<CSSProperties | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const boundary = boundaryRef.current;
    if (!boundary) return;

    const updateBounds = () => {
      const rect = boundary.getBoundingClientRect();
      setPanelBounds(getLearningTaskPanelBounds(rect));
      setPortalTarget(document.fullscreenElement ?? document.body);
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(boundary);
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);
    document.addEventListener('fullscreenchange', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
      document.removeEventListener('fullscreenchange', updateBounds);
    };
  }, [open, boundaryRef]);

  useEffect(() => {
    if (scenes.length === 0) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const next = ensureClassroomLearningTask(classroomId, courseName);
      setTask(next);
      setRecordError(!next);
    });
    return () => {
      cancelled = true;
    };
  }, [classroomId, courseName, scenes.length, retry]);

  const taskId = task?.id;
  useEffect(() => {
    if (
      !taskId ||
      task?.classroomId !== classroomId ||
      !currentSceneId ||
      !scenes.some((scene) => scene.id === currentSceneId)
    )
      return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const updated = recordVisitedScene(taskId, currentSceneId);
      if (updated) setTask(updated);
      setRecordError(!updated);
    });
    return () => {
      cancelled = true;
    };
  }, [currentSceneId, taskId, task?.classroomId, classroomId, scenes]);

  const orderedScenes = useMemo(() => [...scenes].sort((a, b) => a.order - b.order), [scenes]);
  if (!task || task.classroomId !== classroomId)
    return recordError ? (
      <button
        type="button"
        onClick={() => setRetry((value) => value + 1)}
        className="absolute right-4 top-20 z-[70] rounded-xl border bg-background px-3 py-2 text-xs text-destructive"
      >
        学习记录不可用，点击重试
      </button>
    ) : null;

  const currentMarked = !!currentSceneId && task.reviewSceneIds.includes(currentSceneId);
  const progress = scenes.length
    ? Math.round(
        (task.visitedSceneIds.filter((id) => scenes.some((scene) => scene.id === id)).length /
          scenes.length) *
          100,
      )
    : 0;

  const saveNote = () => {
    if (!currentSceneId || !scenes.some((scene) => scene.id === currentSceneId)) return;
    const updated = saveLearningTaskNote(task.id, currentSceneId, noteDraft);
    if (!updated) {
      setRecordError(true);
      return;
    }
    setRecordError(false);
    setTask(updated);
    const savedEdit = { sceneId: currentSceneId, content: noteDraft, saved: true };
    setNoteEdit(savedEdit);
    window.setTimeout(
      () =>
        setNoteEdit((current) => (current === savedEdit ? { ...current, saved: false } : current)),
      1600,
    );
  };

  const toggleReview = () => {
    if (!currentSceneId || !scenes.some((scene) => scene.id === currentSceneId)) return;
    const updated = toggleLearningTaskReviewScene(task.id, currentSceneId);
    if (updated) setTask(updated);
    setRecordError(!updated);
  };

  return (
    <>
      <button
        type="button"
        data-testid="learning-task-panel-trigger"
        onClick={() => setOpen(true)}
        className={cn(
          'absolute right-4 top-20 z-[70] flex h-10 items-center gap-2 rounded-xl border border-primary/25 bg-background/92 px-3 text-sm font-semibold text-foreground shadow-lg backdrop-blur-xl transition hover:border-primary/50 hover:text-primary',
          open && 'pointer-events-none opacity-0',
        )}
      >
        <Target className="size-4 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">学习记录</span>
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
          {progress}%
        </span>
      </button>

      {open && portalTarget && panelBounds
        ? createPortal(
            <div
              data-testid="learning-task-panel"
              className="fixed z-[80] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/96 shadow-2xl backdrop-blur-xl"
              style={panelBounds}
            >
              <header className="flex items-start justify-between border-b border-border/70 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <BookOpenCheck className="size-4" aria-hidden="true" />
                    学习记录 · 按需使用
                  </div>
                  <h2 className="mt-2 truncate text-lg font-semibold">{task.knowledgePoint}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{task.courseName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="关闭学习记录"
                >
                  <X className="size-4" />
                </Button>
              </header>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <section>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">访问进度</span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    自动记录已访问环节。笔记与复习可选，不影响继续上课或结课。
                  </p>
                  {recordError && (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                      学习记录保存失败，请重试；当前进度可能尚未保存。
                    </p>
                  )}
                  {!isAutomaticLearningRecord(task) && (
                    <p className="mt-3 rounded-xl bg-primary/[0.06] p-3 text-sm leading-6 text-foreground">
                      {task.learningGoal}
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">学习路径</h3>
                  <div className="space-y-1">
                    {orderedScenes.map((scene, index) => {
                      const visited = task.visitedSceneIds.includes(scene.id);
                      const marked = task.reviewSceneIds.includes(scene.id);
                      return (
                        <button
                          key={scene.id}
                          type="button"
                          onClick={() => onSelectScene(scene.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted',
                            currentSceneId === scene.id && 'bg-primary/10 text-primary',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground',
                              visited && 'bg-primary text-primary-foreground',
                            )}
                          >
                            {visited ? <Check className="size-3.5" /> : index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {scene.title || `环节 ${index + 1}`}
                          </span>
                          {marked ? (
                            <Bookmark className="size-3.5 fill-current text-amber-500" />
                          ) : null}
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </section>

                {currentSceneId && scenes.some((scene) => scene.id === currentSceneId) ? (
                  <section>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <NotebookPen className="size-3.5" /> 当前环节笔记
                      </h3>
                      <button
                        type="button"
                        onClick={toggleReview}
                        className={cn(
                          'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
                          currentMarked
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Bookmark className={cn('size-3.5', currentMarked && 'fill-current')} />
                        {currentMarked ? '已加入复习' : '加入复习'}
                      </button>
                    </div>
                    <Textarea
                      value={noteDraft}
                      onChange={(event) => {
                        setNoteEdit({
                          sceneId: currentSceneId,
                          content: event.target.value,
                          saved: false,
                        });
                      }}
                      onBlur={saveNote}
                      className="min-h-28 resize-none"
                      placeholder="记录你的理解、疑问或解题提示…"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="outline" onClick={saveNote}>
                        {noteSaved ? '已保存' : '保存笔记'}
                      </Button>
                    </div>
                  </section>
                ) : null}
              </div>
              <footer className="border-t border-border/70 p-4">
                <Button className="w-full" onClick={() => router.push(`/learn/${task.id}/review`)}>
                  查看学习回顾
                </Button>
              </footer>
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/hooks/use-i18n';
import { isLearningLoopEnabled } from '@/lib/config/feature-flags';
import { accessDocument, type AppDocumentOutline } from '@/lib/document-store';
import { listStages } from '@/lib/utils/stage-storage';
import { buildKnowledgeModel } from '@/lib/learning-loop/knowledge-model';
import { LEARNING_JOURNEY_CHANGED_EVENT, readLearningEvidence } from '@/lib/learning-loop/runtime';
import { KNOWLEDGE_CARDS_CHANGED, readKnowledgeCards } from '@/lib/knowledge-cards/storage';
import {
  getLearningTask,
  loadLearningTasks,
  updateLearningTask,
} from '@/lib/learning/task-storage';
import {
  buildReviewWorkbench,
  type ReviewGroup,
  type ReviewWorkbenchItem,
} from '@/lib/learning/review-workbench';
import type { KnowledgeComponent, LearningEvidence } from '@/lib/learning-loop/types';
import { RepairPanel } from '@/components/learning-loop/repair-panel';
import { NoteBody } from './note-body';

const groupLabels: Record<ReviewGroup, [string, string]> = {
  pending: ['待复习', 'To review'],
  not_started: ['未开始', 'Not started'],
  building: ['构建中', 'Building'],
  verified: ['已有验证', 'Verified'],
};
const statusLabels = {
  not_started: ['未开始', 'Not started'],
  in_progress: ['构建中', 'Building'],
  evidence_available: ['已有证据', 'Evidence available'],
  needs_revisit: ['建议回看', 'Revisit suggested'],
  verified: ['已有验证', 'Verified'],
};

export function ReviewWorkbench() {
  const params = useSearchParams();
  const stageId = params.get('course') ?? '';
  return <CourseReviewWorkbench key={stageId} stageId={stageId} />;
}

function CourseReviewWorkbench({ stageId }: { stageId: string }) {
  const { locale } = useI18n();
  const zh = locale === 'zh-CN';
  const router = useRouter();
  const enabled = isLearningLoopEnabled();
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [coursesError, setCoursesError] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    stageId: string;
    title: string;
    items: ReviewWorkbenchItem[];
    evidence: LearningEvidence[];
  }>();
  const [loading, setLoading] = useState(Boolean(stageId));
  const [error, setError] = useState(false);
  const [group, setGroup] = useState<ReviewGroup>('pending');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [repair, setRepair] = useState<KnowledgeComponent>();
  const [lastReviewedId, setLastReviewedId] = useState<string>();
  const retry = useCallback(() => {
    setLoading(Boolean(stageId));
    setError(false);
    setCatalogLoading(true);
    setCoursesError(false);
    setRefresh((value) => value + 1);
  }, [stageId]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listStages()
      .then((items) => {
        if (!cancelled) setCourses(items);
      })
      .catch(() => {
        if (!cancelled) setCoursesError(true);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || !stageId) return;
    let cancelled = false;
    Promise.all([
      accessDocument(stageId),
      readLearningEvidence(stageId),
      readKnowledgeCards(stageId),
    ])
      .then(([access, evidence, cards]) => {
        if (!access.document) throw new Error('Course unavailable');
        const document = access.document;
        const model = buildKnowledgeModel(
          document.stage,
          document.scenes,
          (document.outline as AppDocumentOutline | undefined)?.outlines ?? [],
        );
        if (!cancelled)
          setSnapshot({
            stageId,
            title: document.stage.name,
            items: buildReviewWorkbench(model, evidence, loadLearningTasks(), cards),
            evidence,
          });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, stageId, refresh]);
  useEffect(() => {
    const update = retry;
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ stageId?: string }>).detail?.stageId === stageId) update();
    };
    window.addEventListener('focus', update);
    window.addEventListener('storage', update);
    window.addEventListener(LEARNING_JOURNEY_CHANGED_EVENT, changed);
    window.addEventListener(KNOWLEDGE_CARDS_CHANGED, changed);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('storage', update);
      window.removeEventListener(LEARNING_JOURNEY_CHANGED_EVENT, changed);
      window.removeEventListener(KNOWLEDGE_CARDS_CHANGED, changed);
    };
  }, [stageId, retry]);
  const current = snapshot?.stageId === stageId ? snapshot : undefined;
  const lastReviewed = current?.items.find((item) => item.component.id === lastReviewedId);
  const needle = query.trim().toLocaleLowerCase();
  const visible =
    current?.items.filter(
      (item) =>
        item.group === group &&
        [
          item.component.title,
          item.component.objective,
          ...item.notes.map((note) => note.content),
          ...item.cards.map((card) => `${card.title}\n${card.body}`),
        ]
          .join('\n')
          .toLocaleLowerCase()
          .includes(needle),
    ) ?? [];
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="min-h-10 content-center text-sm text-primary">
            ← {zh ? '返回学习空间' : 'Learning space'}
          </Link>
          <h1 className="text-lg font-semibold">{zh ? '课后复习工作台' : 'Review workspace'}</h1>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {!enabled ? (
          <p>
            {zh
              ? '学习闭环尚未开启。已有任务回顾仍可从学习任务中进入。'
              : 'Learning loop is disabled. Existing task reviews remain available.'}
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              {zh
                ? '先处理未解决的问题，再回顾主动标记的内容。阅读笔记不等于验证通过，未开始也不代表没学会。'
                : 'Review unresolved questions and your bookmarks. Reading notes is not verification; unstarted is not a failure.'}
            </p>
            <div className="space-y-2">
              <label htmlFor="review-course" className="block text-sm font-medium">
                {zh ? '选择复习课程' : 'Choose a course'}
              </label>
              <select
                id="review-course"
                value={stageId}
                onChange={(event) =>
                  router.push(
                    event.target.value
                      ? `/review?course=${encodeURIComponent(event.target.value)}`
                      : '/review',
                  )
                }
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3 sm:max-w-lg"
              >
                <option value="">{zh ? '请选择课程' : 'Select a course'}</option>
                {stageId && !courses.some((course) => course.id === stageId) && (
                  <option value={stageId}>
                    {current?.title ?? (zh ? '链接指定的课程' : 'Linked course')}
                  </option>
                )}
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              {catalogLoading && (
                <p className="text-xs text-muted-foreground">
                  {zh ? '正在读取课程列表…' : 'Loading courses…'}
                </p>
              )}
              {coursesError && (
                <p role="alert">
                  {zh ? '课程列表读取失败。' : 'Could not load courses.'}
                  <button
                    type="button"
                    className="ml-2 min-h-10 text-primary underline"
                    onClick={retry}
                  >
                    {zh ? '重试' : 'Retry'}
                  </button>
                </p>
              )}
              {!stageId && !catalogLoading && !coursesError && courses.length === 0 && (
                <p>
                  {zh
                    ? '暂无课程，先返回学习空间创建或导入课程。'
                    : 'No courses yet. Create or import a course first.'}
                </p>
              )}
            </div>
            {stageId &&
              (loading ? (
                <p role="status">{zh ? '正在整理复习内容…' : 'Loading review…'}</p>
              ) : error ? (
                <div role="alert" className="rounded-2xl border p-5">
                  {zh
                    ? '课程或学习记录暂时不可用，未推断任何理解状态。请重试或选择其他课程。'
                    : 'Course or learning records unavailable. No learning state was inferred.'}
                  <button
                    type="button"
                    className="ml-2 min-h-10 text-primary underline"
                    onClick={retry}
                  >
                    {zh ? '重试' : 'Retry'}
                  </button>
                </div>
              ) : (
                current && (
                  <>
                    <h2 className="break-words text-xl font-semibold">{current.title}</h2>
                    {lastReviewed && (
                      <div
                        role="status"
                        className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"
                      >
                        {zh ? '补学后的最新状态：' : 'Latest state after repair: '}
                        {lastReviewed.component.title} ·{' '}
                        {statusLabels[lastReviewed.state.status][zh ? 0 : 1]}
                        <button
                          type="button"
                          className="ml-3 min-h-10 text-primary underline"
                          onClick={() => {
                            setGroup(lastReviewed.group);
                            setQuery('');
                            setLimit(10);
                          }}
                        >
                          {zh ? '查看所在分类' : 'Show its group'}
                        </button>
                      </div>
                    )}
                    <div
                      className="flex flex-wrap gap-2"
                      aria-label={zh ? '复习分类' : 'Review filters'}
                    >
                      {(Object.keys(groupLabels) as ReviewGroup[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={group === key}
                          onClick={() => {
                            setGroup(key);
                            setLimit(10);
                          }}
                          className={`min-h-11 rounded-xl border px-4 text-sm ${group === key ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                        >
                          {groupLabels[key][zh ? 0 : 1]} ·{' '}
                          {current.items.filter((item) => item.group === key).length}
                        </button>
                      ))}
                    </div>
                    <label className="block">
                      <span className="sr-only">
                        {zh ? '搜索复习内容' : 'Search review content'}
                      </span>
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setLimit(10);
                        }}
                        placeholder={
                          zh
                            ? '搜索当前分类的构件、笔记和知识卡'
                            : 'Search components, notes and cards in this group'
                        }
                        className="min-h-11 w-full rounded-xl border border-border bg-card px-3"
                      />
                    </label>
                    {visible.length === 0 ? (
                      <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                        {zh
                          ? '当前分类没有匹配内容。可切换分类或调整搜索；待复习为空不代表全部已经验证。'
                          : 'No matches in this group. Try another filter. An empty review queue does not mean everything is verified.'}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {visible.slice(0, limit).map((item) => (
                          <ReviewItem
                            key={item.component.id}
                            item={item}
                            zh={zh}
                            onRepair={() => setRepair(item.component)}
                            onChanged={retry}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>
                        {zh
                          ? `已显示 ${Math.min(limit, visible.length)} / ${visible.length} 项`
                          : `${Math.min(limit, visible.length)} of ${visible.length}`}
                      </span>
                      {limit < visible.length && (
                        <button
                          type="button"
                          className="min-h-10 text-primary"
                          onClick={() => setLimit((value) => value + 10)}
                        >
                          {zh ? '加载更多' : 'Load more'}
                        </button>
                      )}
                    </div>
                  </>
                )
              ))}
          </>
        )}
      </div>
      {enabled && repair && repair.stageId === stageId && current && (
        <RepairPanel
          key={`${repair.id}:${repair.contentRevision ?? ''}`}
          component={repair}
          returnLabel={zh ? '返回复习清单' : 'Return to review list'}
          evidence={
            current.items.find((item) => item.component.id === repair.id)?.state.evidence ?? []
          }
          isChinese={zh}
          onClose={() => {
            setLastReviewedId(repair.id);
            setRepair(undefined);
            retry();
          }}
        />
      )}
    </main>
  );
}

function ReviewItem({
  item,
  zh,
  onRepair,
  onChanged,
}: {
  item: ReviewWorkbenchItem;
  zh: boolean;
  onRepair: () => void;
  onChanged: () => void;
}) {
  const [writeError, setWriteError] = useState(false);
  const [materialLimit, setMaterialLimit] = useState(10);
  const materials = [
    ...item.notes.map((note) => ({
      key: `note:${note.taskId}:${note.sceneId}`,
      title: `${zh ? '任务笔记' : 'Task note'} · ${note.title}`,
      body: note.content,
    })),
    ...item.cards.map((card) => ({
      key: card.sessionId,
      title: `${zh ? '知识卡' : 'Knowledge card'} · ${card.title}`,
      body: card.body,
    })),
  ];
  return (
    <article
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      data-testid="review-workbench-item"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="break-words font-semibold">{item.component.title}</h3>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
          {statusLabels[item.state.status][zh ? 0 : 1]}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {item.state.status === 'needs_revisit'
          ? zh
            ? '当前版本仍有未解决的问题，建议先补学再验证。'
            : 'Unresolved questions remain. Try repair and verification.'
          : item.state.status === 'not_started'
            ? zh
              ? '尚无当前版本的学习证据，请先进入课堂学习。'
              : 'No current-version evidence yet. Start in class.'
            : item.state.status === 'verified'
              ? zh
                ? '当前证据支持理解，可按需要巩固。'
                : 'Current evidence supports understanding.'
              : zh
                ? '已有学习活动，但验证依据还不充分。'
                : 'Learning activity exists; verification is still insufficient.'}
      </p>
      {item.markedTasks.length > 0 && (
        <div className="mt-3 space-y-1 text-xs">
          {item.markedTasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-1"
            >
              <span>
                {zh ? '主动标记' : 'Bookmarked'} · {task.knowledgePoint}
              </span>
              <button
                type="button"
                className="min-h-10 text-primary"
                onClick={() => {
                  const latest = getLearningTask(task.id);
                  if (!latest || latest.classroomId !== item.component.stageId) {
                    setWriteError(true);
                    return;
                  }
                  const saved = updateLearningTask(task.id, {
                    reviewSceneIds: latest.reviewSceneIds.filter(
                      (id) => !item.component.sceneIds.includes(id),
                    ),
                  });
                  setWriteError(!saved);
                  if (saved) onChanged();
                }}
              >
                {zh ? '取消主动标记' : 'Remove bookmark'}
              </button>
            </div>
          ))}
          <p className="text-muted-foreground">
            {zh
              ? '取消标记只整理清单，不改变理解状态。'
              : 'Removing bookmarks does not change understanding.'}
          </p>
          {writeError && (
            <p role="alert">
              {zh ? '标记未能保存，请重试。' : 'Could not save the bookmark change. Retry.'}
            </p>
          )}
        </div>
      )}
      {item.component.objective && (
        <NoteBody text={item.component.objective} zh={zh} className="mt-3 text-sm leading-6" />
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {item.component.sceneIds[0] && (
          <Link
            href={`/classroom/${encodeURIComponent(item.component.stageId)}?scene=${encodeURIComponent(item.component.sceneIds[0])}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm text-primary"
          >
            {zh ? '返回构件学习' : 'Open learning block'}
          </Link>
        )}
        {item.state.status !== 'not_started' && (
          <button
            type="button"
            onClick={onRepair}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm text-primary-foreground"
          >
            {zh ? '开始补学验证' : 'Repair and verify'}
          </button>
        )}
      </div>
      <details className="mt-4 rounded-xl border border-border/70 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {zh
            ? `关联资料 · ${item.notes.length} 条笔记 · ${item.cards.length} 张知识卡`
            : `Resources · ${item.notes.length} notes · ${item.cards.length} cards`}
        </summary>
        <div className="mt-3 space-y-3">
          {materials.length ? (
            materials.slice(0, materialLimit).map((material) => (
              <div key={material.key} className="rounded-xl bg-muted/40 p-3">
                <h4 className="break-words text-xs font-semibold">{material.title}</h4>
                <NoteBody text={material.body} zh={zh} className="mt-2 text-sm leading-6" />
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              {zh ? '该构件还没有关联笔记或知识卡。' : 'No notes or cards for this component yet.'}
            </p>
          )}
          {materialLimit < materials.length && (
            <button
              type="button"
              className="min-h-10 text-sm text-primary"
              onClick={() => setMaterialLimit((value) => value + 10)}
            >
              {zh ? '加载更多资料' : 'Load more resources'}
            </button>
          )}
        </div>
      </details>
    </article>
  );
}

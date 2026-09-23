'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import type { LearningTask } from '@/lib/learning/types';
import { isAutomaticLearningRecord, learningRecordHref } from '@/lib/learning/task-presentation';
import { NoteBody } from './note-body';

/** Notes are the primary items here, not the tasks that happen to contain them. */
export function TaskNoteList({ tasks, zh }: { tasks: LearningTask[]; zh: boolean }) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const notes = tasks
    .flatMap((task) =>
      Object.values(task.notes)
        .filter((note) => note.content.trim())
        .map((note) => ({ task, note })),
    )
    .sort((a, b) => b.note.updatedAt - a.note.updatedAt);
  const needle = query.trim().toLocaleLowerCase();
  const visible = notes.filter(({ task, note }) =>
    `${task.courseName}\n${task.knowledgePoint}\n${note.content}`
      .toLocaleLowerCase()
      .includes(needle),
  );

  return (
    <section aria-label={zh ? '任务笔记' : 'Task notes'} className="mx-5 mb-5 sm:mx-7">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {zh ? '任务笔记' : 'Task notes'} · {notes.length}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {zh
              ? '直接阅读你写下的理解，按最近修改排序。'
              : 'Read your own notes, most recently updated first.'}
          </p>
        </div>
        {notes.length > 0 && (
          <div className="w-full sm:w-64">
            <label htmlFor={searchId} className="sr-only">
              {zh ? '搜索任务笔记' : 'Search task notes'}
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(10);
              }}
              placeholder={zh ? '搜索正文、课程或知识点' : 'Search notes, courses or topics'}
              className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
        )}
      </div>
      {visible.length ? (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {visible.slice(0, limit).map(({ task, note }) => (
            <article
              key={`${task.id}:${note.sceneId}`}
              className="min-w-0 rounded-2xl border border-border/70 bg-background/70 p-4"
              data-testid="task-note-item"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="break-words">{task.courseName}</span>
                <time dateTime={new Date(note.updatedAt).toISOString()}>
                  {new Date(note.updatedAt).toLocaleDateString(zh ? 'zh-CN' : 'en-US')}
                </time>
              </div>
              <h4 className="mt-2 break-words text-sm font-semibold">{task.knowledgePoint}</h4>
              <NoteBody text={note.content} zh={zh} className="mt-3 text-sm leading-7" />
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 pt-2 text-xs">
                {task.classroomId ? (
                  <Link
                    className="inline-flex min-h-10 items-center font-medium text-primary hover:underline"
                    href={`/classroom/${encodeURIComponent(task.classroomId)}?scene=${encodeURIComponent(note.sceneId)}`}
                  >
                    {zh ? '返回笔记所在环节' : 'Open source scene'}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {zh ? '尚未关联课堂' : 'No classroom linked'}
                  </span>
                )}
                <Link
                  href={learningRecordHref(task)}
                  className="inline-flex min-h-10 items-center text-muted-foreground hover:text-primary"
                >
                  {isAutomaticLearningRecord(task)
                    ? zh
                      ? '查看课程'
                      : 'View course'
                    : zh
                      ? '查看学习任务'
                      : 'View learning task'}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
          {notes.length
            ? zh
              ? '没有匹配的笔记，试试其他关键词。'
              : 'No matching notes. Try another keyword.'
            : zh
              ? '还没有任务笔记。在课堂的学习任务面板中记下你的理解，保存后会直接显示在这里。'
              : 'No task notes yet. Write a note in the classroom learning-task panel to see it here.'}
        </p>
      )}
      {visible.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span role="status">
            {zh
              ? `已显示 ${Math.min(limit, visible.length)} / ${visible.length} 条`
              : `Showing ${Math.min(limit, visible.length)} of ${visible.length}`}
          </span>
          {limit < visible.length && (
            <button
              type="button"
              onClick={() => setLimit((value) => value + 10)}
              className="min-h-10 rounded-xl border border-border px-4 font-medium text-primary"
            >
              {zh ? '加载更多任务笔记' : 'Load more task notes'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

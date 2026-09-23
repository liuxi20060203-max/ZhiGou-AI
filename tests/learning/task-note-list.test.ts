// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { TaskNoteList } from '@/components/learning/task-note-list';
import type { LearningTask } from '@/lib/learning/types';

const task: LearningTask = {
  schemaVersion: 1,
  id: 'task',
  template: 'concept-understanding',
  courseName: '数学课',
  knowledgePoint: '小数',
  learningGoal: '',
  priorKnowledge: '',
  status: 'ready',
  classroomId: 'course',
  visitedSceneIds: [],
  reviewSceneIds: [],
  createdAt: 1,
  updatedAt: 1,
  notes: {
    first: { sceneId: 'first', content: '旧笔记：小数表示部分', updatedAt: 1 },
    second: { sceneId: 'second', content: '新笔记：一半是 0.5\n四分之一是 0.25', updatedAt: 2 },
    empty: { sceneId: 'empty', content: '  ', updatedAt: 3 },
  },
};
it('loads ten at a time and searches beyond the displayed page, resetting the page size', async () => {
  const notes = Object.fromEntries(
    Array.from({ length: 23 }, (_, index) => [
      `s${index}`,
      { sceneId: `s${index}`, content: `笔记编号 ${index}`, updatedAt: index },
    ]),
  );
  await act(async () =>
    root.render(createElement(TaskNoteList, { tasks: [{ ...task, notes }], zh: true })),
  );
  expect(container.querySelectorAll('article')).toHaveLength(10);
  const more = () =>
    [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '加载更多任务笔记',
    )!;
  await act(async () => more().click());
  expect(container.querySelectorAll('article')).toHaveLength(20);
  await act(async () => more().click());
  expect(container.querySelectorAll('article')).toHaveLength(23);
  expect(more()).toBeUndefined();
  const input = container.querySelector('input')!;
  const search = async (value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await search('编号 0');
  expect(container.querySelectorAll('article')).toHaveLength(1);
  expect(container.textContent).toContain('笔记编号 0');
  await search('');
  expect(container.querySelectorAll('article')).toHaveLength(10);
});
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it('shows actual full notes newest first with source links, without blank notes', async () => {
  await act(async () => root.render(createElement(TaskNoteList, { tasks: [task], zh: true })));
  const items = container.querySelectorAll('article');
  expect(items).toHaveLength(2);
  expect(items[0]?.textContent).toContain(task.notes.second!.content);
  expect(items[0]?.textContent).toContain('数学课');
  expect(items[0]?.querySelector('a')?.getAttribute('href')).toBe('/classroom/course?scene=second');
  expect(items[1]?.textContent).toContain('旧笔记');
});
it('filters by content and shows a clear no-match state', async () => {
  await act(async () => root.render(createElement(TaskNoteList, { tasks: [task], zh: true })));
  const input = container.querySelector('input')!;
  const search = async (value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await search('四分之一');
  expect(container.querySelectorAll('article')).toHaveLength(1);
  expect(container.textContent).not.toContain('旧笔记');
  await search('不存在');
  expect(container.querySelectorAll('article')).toHaveLength(0);
  expect(container.textContent).toContain('没有匹配的笔记');
  await search('数学课');
  expect(container.querySelectorAll('article')).toHaveLength(2);
});
it('keeps notes readable when no classroom is linked and explains an empty list', async () => {
  await act(async () =>
    root.render(
      createElement(TaskNoteList, { tasks: [{ ...task, classroomId: undefined }], zh: true }),
    ),
  );
  expect(container.textContent).toContain('尚未关联课堂');
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/learn/task');
  await act(async () => root.render(createElement(TaskNoteList, { tasks: [], zh: true })));
  expect(container.textContent).toContain('还没有任务笔记');
});

// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RecentTaskList } from '@/components/learning/recent-task-list';
const mocks = vi.hoisted(() => ({ push: vi.fn(), read: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/demo/golden-classroom', () => ({ ensureGoldenDemoClassroom: vi.fn() }));
vi.mock('@/lib/hooks/use-i18n', () => ({ useI18n: () => ({ locale: 'zh-CN' }) }));
vi.mock('@/lib/config/feature-flags', () => ({ isLearningLoopEnabled: () => true }));
vi.mock('@/lib/learning/task-storage', () => ({
  loadLearningTasks: () => [],
  updateLearningTask: vi.fn(),
  LEARNING_TASK_DRAFT_SESSION_KEY: 'draft',
}));
vi.mock('@/lib/knowledge-cards/storage', () => ({
  readAllKnowledgeCards: mocks.read,
  readKnowledgeCards: mocks.read,
  deleteKnowledgeCard: vi.fn(),
  saveKnowledgeCard: vi.fn(),
  KNOWLEDGE_CARDS_CHANGED: 'cards-changed',
}));
it('paginates knowledge cards and searches all bodies, including cards not displayed yet', async () => {
  mocks.read.mockResolvedValue(
    Array.from({ length: 23 }, (_, index) => ({
      sessionId: `card-${index}`,
      title: `卡片 ${index}`,
      body: `正文标识-${index}-结束`,
      source: { stageId: 'course', stageTitle: '课程', speaker: '助教' },
    })),
  );
  await act(async () => root.render(createElement(RecentTaskList)));
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[data-testid="task-filter-notes"]')!.click(),
  );
  const list = container.querySelector('[data-testid="knowledge-card-list"]')!;
  expect(list.querySelectorAll('article')).toHaveLength(10);
  const more = () =>
    [...list.querySelectorAll('button')].find((button) => button.textContent === '加载更多知识卡')!;
  await act(async () => more().click());
  expect(list.querySelectorAll('article')).toHaveLength(20);
  await act(async () => more().click());
  expect(list.querySelectorAll('article')).toHaveLength(23);
  expect(more()).toBeUndefined();
  const input = list.querySelector('input')!;
  const search = async (value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await search('标识-22-');
  expect(list.querySelectorAll('article')).toHaveLength(1);
  expect(list.textContent).toContain('卡片 22');
  await search('');
  expect(list.querySelectorAll('article')).toHaveLength(10);
});
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.read.mockReset();
  mocks.push.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it('shows a knowledge card in learning notes without a learning task, and refreshes the count', async () => {
  mocks.read.mockResolvedValue([
    {
      sessionId: 'card',
      seq: 0,
      title: '小数的意义卡片',
      body: '一半就是 0.5',
      source: {
        stageId: 'free-course',
        sceneId: 'scene-1',
        stageTitle: '自由课程',
        sceneTitle: '小数',
        speaker: '助教',
      },
    },
  ]);
  await act(async () => root.render(createElement(RecentTaskList)));
  const filter = container.querySelector<HTMLButtonElement>('[data-testid="task-filter-notes"]')!;
  expect(filter.textContent).toContain('0 条笔记 · 1 张知识卡');
  await act(async () => filter.click());
  expect(container.textContent).toContain('小数的意义卡片');
  expect(container.textContent).toContain('自由课程');
  expect(container.textContent).not.toContain('暂时还没有学习笔记');
  const back = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '返回来源课堂',
  )!;
  await act(async () => back.click());
  expect(mocks.push).toHaveBeenCalledWith('/classroom/free-course?scene=scene-1');
  mocks.read.mockResolvedValue([]);
  await act(async () =>
    window.dispatchEvent(new CustomEvent('cards-changed', { detail: { stageId: 'free-course' } })),
  );
  expect(filter.textContent).toContain('0 条笔记 · 0 张知识卡');
  expect(container.textContent).not.toContain('小数的意义卡片');
});
it('reports loading failure instead of claiming there are no cards', async () => {
  mocks.read.mockRejectedValue(new Error('unavailable'));
  await act(async () => root.render(createElement(RecentTaskList)));
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[data-testid="task-filter-notes"]')!.click(),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('读取或删除失败');
  expect(container.querySelector('[data-testid="task-filter-notes"]')?.textContent).toContain(
    '— 张知识卡',
  );
});

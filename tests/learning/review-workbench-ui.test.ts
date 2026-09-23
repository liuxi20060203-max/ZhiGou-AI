// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ReviewWorkbench } from '@/components/learning/review-workbench';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams('course=s'),
  access: vi.fn(),
  evidence: vi.fn(),
  cards: vi.fn(),
  update: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mocks.params,
}));
vi.mock('@/lib/hooks/use-i18n', () => ({ useI18n: () => ({ locale: 'zh-CN' }) }));
vi.mock('@/lib/config/feature-flags', () => ({ isLearningLoopEnabled: () => true }));
vi.mock('@/lib/document-store', () => ({ accessDocument: mocks.access }));
vi.mock('@/lib/utils/stage-storage', () => ({
  listStages: async () => [{ id: 's', name: '课程' }],
}));
vi.mock('@/lib/learning-loop/runtime', () => ({
  readLearningEvidence: mocks.evidence,
  LEARNING_JOURNEY_CHANGED_EVENT: 'evidence-changed',
}));
vi.mock('@/lib/knowledge-cards/storage', () => ({
  readKnowledgeCards: mocks.cards,
  KNOWLEDGE_CARDS_CHANGED: 'cards-changed',
}));
vi.mock('@/lib/learning/task-storage', () => ({
  loadLearningTasks: () => [],
  getLearningTask: vi.fn(),
  updateLearningTask: mocks.update,
}));
vi.mock('@/components/learning-loop/repair-panel', () => ({
  RepairPanel: ({ onClose, returnLabel }: { onClose: () => void; returnLabel: string }) =>
    createElement('button', { onClick: onClose }, returnLabel),
}));
const doc = {
  stage: { id: 's', name: '课程' },
  scenes: [
    {
      id: 'a',
      stageId: 's',
      title: '小数',
      type: 'quiz',
      order: 0,
      content: { type: 'quiz', questions: [] },
    },
  ],
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.params = new URLSearchParams('course=s');
  mocks.access.mockReset().mockResolvedValue({ document: doc });
  mocks.evidence.mockReset().mockResolvedValue([]);
  mocks.cards.mockReset().mockResolvedValue([]);
  mocks.update.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const button = (text: string) =>
  [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
it('discards a late response after changing courses', async () => {
  let resolveOld!: (value: unknown) => void;
  mocks.access.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await act(async () => root.render(createElement(ReviewWorkbench)));
  mocks.params = new URLSearchParams('course=new');
  mocks.access.mockResolvedValue({
    document: { stage: { id: 'new', name: '新课程' }, scenes: [] },
  });
  await act(async () => root.render(createElement(ReviewWorkbench)));
  await act(async () => resolveOld({ document: doc }));
  expect(container.querySelector('h2')?.textContent).toBe('新课程');
  expect(container.querySelector('[data-testid="review-workbench-item"]')).toBeNull();
});
it('does not infer weak points or mutate task status merely by opening the workspace', async () => {
  await act(async () => root.render(createElement(ReviewWorkbench)));
  expect(button('待复习').textContent).toContain('0');
  expect(button('未开始').textContent).toContain('1');
  expect(mocks.update).not.toHaveBeenCalled();
  await act(async () => button('未开始').click());
  expect(container.textContent).toContain('尚无当前版本');
  expect(button('开始补学验证')).toBeUndefined();
});
it('shows read failures with retry, never a fabricated empty learning state', async () => {
  mocks.evidence.mockRejectedValueOnce(Error('unavailable'));
  await act(async () => root.render(createElement(ReviewWorkbench)));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('未推断任何理解状态');
  expect(button('未开始')).toBeUndefined();
  await act(async () => button('重试').click());
  expect(button('未开始').textContent).toContain('1');
});
it('refreshes persisted evidence on closing repair and explains where the component moved', async () => {
  const event = {
    stageId: 's',
    componentId: 'kc:s:a',
    eventId: 'confusion',
    type: 'learner_confusion',
    outcome: 'contradicts',
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload: {},
  };
  mocks.evidence.mockResolvedValue([event]);
  await act(async () => root.render(createElement(ReviewWorkbench)));
  await act(async () => button('开始补学验证').click());
  mocks.evidence.mockResolvedValue([
    event,
    {
      ...event,
      eventId: 'passed',
      type: 'verification_passed',
      outcome: 'supports',
      occurredAt: '2026-01-02T00:00:00.000Z',
    },
  ]);
  await act(async () => button('返回复习清单').click());
  expect(container.querySelector('[role="status"]')?.textContent).toContain('已有验证');
  expect(button('待复习').textContent).toContain('0');
  await act(async () => button('查看所在分类').click());
  expect(container.querySelector('[data-testid="review-workbench-item"]')?.textContent).toContain(
    '小数',
  );
});

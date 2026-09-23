// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { KnowledgeCardEditor } from '@/components/knowledge-cards/card-editor';
import { SaveMessageCard } from '@/components/knowledge-cards/save-message-card';
import type { ChatSession } from '@/lib/types/chat';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    createElement('section', { role: 'dialog' }, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => createElement('h2', null, children),
}));
vi.mock('@/lib/hooks/use-i18n', () => ({ useI18n: () => ({ locale: 'zh-CN' }) }));
vi.mock('@/lib/config/feature-flags', () => ({ isLearningLoopEnabled: () => true }));
vi.mock('@/lib/store', () => ({
  useStageStore: (selector: (state: unknown) => unknown) =>
    selector({ stage: { id: 's', name: '课程' }, scenes: [] }),
}));
vi.mock('@/lib/knowledge-cards/storage', () => ({
  readKnowledgeCards: async () => [],
  saveKnowledgeCard: vi.fn(),
}));
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
it('keeps content on failed save and allows retry before closing', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(undefined);
  const onClose = vi.fn();
  await act(async () =>
    root.render(
      createElement(KnowledgeCardEditor, {
        initial: { title: '标题', body: '正文' },
        source: {
          stageId: 's',
          stageTitle: '课程',
          chatSessionId: 'c',
          messageId: 'm',
          speaker: 'AI',
          kind: 'qa',
        },
        isChinese: true,
        onSave,
        onClose,
      }),
    ),
  );
  const submit = () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await act(async () => {
    submit();
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('保存失败');
  expect(container.querySelector('textarea')?.value).toBe('正文');
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => {
    submit();
  });
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledOnce();
});
it('keeps the captured card editor open when playback advances or streaming begins', async () => {
  const session = { id: 'c', type: 'qa', title: '问题' } as ChatSession;
  const message = {
    id: 'm',
    role: 'assistant' as const,
    parts: [{ type: 'text' as const, text: '原始发言' }],
  };
  await act(async () =>
    root.render(createElement(SaveMessageCard, { session, message, streaming: false })),
  );
  await act(async () => container.querySelector('button')!.click());
  expect(container.querySelector('textarea')?.value).toBe('原始发言');
  await act(async () => root.render(createElement(SaveMessageCard, { streaming: true })));
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(container.querySelector('textarea')?.value).toBe('原始发言');
});

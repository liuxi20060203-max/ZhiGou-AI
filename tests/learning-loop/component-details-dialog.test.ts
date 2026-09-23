// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentDetailsDialog } from '@/components/learning-loop/component-details-dialog';
import type { ComponentLearningState } from '@/lib/learning-loop/fold';
import type { KnowledgeComponent, LearningEvidence } from '@/lib/learning-loop/types';

vi.mock('@/components/ui/dialog', async () => {
  const { createElement } = await import('react');
  return {
    Dialog: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
    DialogContent: ({
      children,
      className,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      className: string;
      'data-testid'?: string;
    }) => createElement('div', { className, 'data-testid': testId }, children),
    DialogTitle: ({ children }: { children: React.ReactNode }) =>
      createElement('h2', null, children),
  };
});

const component: KnowledgeComponent = {
  id: 'kc:stage:scene',
  stageId: 'stage',
  title: '什么是小数？',
  objective: '理解小数的意义',
  keyPoints: ['小数的定义与表示方法', '小数的作用'],
  sceneIds: ['scene'],
  prerequisiteIds: [],
  verification: { requiredEvidenceCount: 1, acceptedEvidenceTypes: ['verification_passed'] },
  source: 'outline-derived',
  version: 1,
};

function evidence(index: number): LearningEvidence {
  return {
    eventId: `event-${index}`,
    stageId: 'stage',
    learnerKey: 'learner',
    componentId: component.id,
    sceneId: 'scene',
    type: 'quiz_reviewed',
    outcome: 'contradicts',
    strength: 'strong',
    source: 'quiz',
    payload: { attemptId: `attempt-${index}` },
    occurredAt: new Date(2026, 0, index + 1).toISOString(),
    schemaVersion: 1,
  };
}

describe('component details dialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('opens owner editing in the same dialog and retains the form on a failed save', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(
        createElement(ComponentDetailsDialog, {
          component,
          isChinese: true,
          onClose: vi.fn(),
          onMarkConfusion: vi.fn(),
          onStartRepair: vi.fn(),
          onSave,
        }),
      ),
    );
    const edit = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '编辑目标与验证题',
    )!;
    await act(async () => edit.click());
    expect(container.querySelectorAll('[data-testid="knowledge-component-details"]')).toHaveLength(
      1,
    );
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('保存未成功确认');
    expect(container.querySelector('textarea')?.value).toBe(component.objective);
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSave).toHaveBeenLastCalledWith({
      objective: component.objective,
      keyPoints: component.keyPoints,
    });
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('修改已保存');
  });

  it('shows the objective and a clear empty state without inventing evidence', async () => {
    const onMarkConfusion = vi.fn();
    await act(async () => {
      root.render(
        createElement(ComponentDetailsDialog, {
          component,
          isChinese: true,
          onClose: vi.fn(),
          onMarkConfusion,
          onStartRepair: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain('理解小数的意义');
    expect(container.textContent).toContain('小数的定义与表示方法');
    expect(container.textContent).toContain('理解证据 · 0 条');
    expect(container.textContent).toContain('尚未记录理解证据');
    expect(container.textContent).not.toContain('编辑目标与验证题');
    const action = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '这里没懂',
    );
    await act(async () => action!.click());
    expect(onMarkConfusion).toHaveBeenCalledOnce();
  });

  it('keeps long evidence scrollable and opens repair for a revisit state', async () => {
    const onStartRepair = vi.fn();
    const learningState: ComponentLearningState = {
      componentId: component.id,
      status: 'needs_revisit',
      evidence: Array.from({ length: 6 }, (_, index) => evidence(index)),
    };
    await act(async () => {
      root.render(
        createElement(ComponentDetailsDialog, {
          component,
          learningState,
          isChinese: true,
          onClose: vi.fn(),
          onMarkConfusion: vi.fn(),
          onStartRepair,
        }),
      );
    });

    expect(container.querySelectorAll('[data-testid="learning-evidence-list"] li')).toHaveLength(4);
    expect(
      container.querySelector('[data-testid="knowledge-component-details"]')?.className,
    ).toContain('100dvh');
    const expand = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('查看全部 6 条证据'),
    );
    await act(async () => expand!.click());
    expect(container.querySelectorAll('[data-testid="learning-evidence-list"] li')).toHaveLength(6);
    const action = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '开始补学',
    );
    await act(async () => action!.click());
    expect(onStartRepair).toHaveBeenCalledOnce();
  });

  it('updates the open dialog when newer evidence verifies the component', async () => {
    const onMarkConfusion = vi.fn();
    const firstState: ComponentLearningState = {
      componentId: component.id,
      status: 'in_progress',
      evidence: [{ ...evidence(0), type: 'scene_visited', outcome: 'neutral', strength: 'weak' }],
    };
    const verifiedState: ComponentLearningState = {
      componentId: component.id,
      status: 'verified',
      evidence: [
        ...firstState.evidence,
        { ...evidence(1), type: 'verification_passed', outcome: 'supports' },
      ],
    };
    const render = async (learningState: ComponentLearningState) => {
      await act(async () => {
        root.render(
          createElement(ComponentDetailsDialog, {
            component,
            learningState,
            isChinese: true,
            onClose: vi.fn(),
            onMarkConfusion,
            onStartRepair: vi.fn(),
          }),
        );
      });
    };

    await render(firstState);
    expect(container.textContent).toContain('构建中');
    await render(verifiedState);
    expect(container.textContent).toContain('已有验证');
    expect(container.textContent).toContain('理解证据 · 2 条');
    const action = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '这里没懂',
    );
    await act(async () => action!.click());
    expect(onMarkConfusion).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RepairPanel } from '@/components/learning-loop/repair-panel';
import type { KnowledgeComponent, RepairPlan } from '@/lib/learning-loop/types';

const runtime = vi.hoisted(() => ({
  readRepairPlans: vi.fn(),
  appendRepairPlanSnapshot: vi.fn(),
  appendLearningEvidence: vi.fn(),
  notifyLearningJourneyChanged: vi.fn(),
}));

vi.mock('@/lib/learning-loop/runtime', () => runtime);
vi.mock('@/lib/learning-loop/analytics', () => ({ trackLearningLoopEvent: vi.fn() }));
vi.mock('@/lib/utils/model-config', () => ({
  getCurrentModelConfig: () => ({ modelString: 'test-model', apiKey: '' }),
}));
vi.mock('@/components/ui/dialog', async () => {
  const { createElement } = await import('react');
  return {
    Dialog: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
    DialogContent: ({ children }: { children: React.ReactNode }) =>
      createElement('div', null, children),
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

describe('repair panel lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let snapshots: RepairPlan[];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    snapshots = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    runtime.readRepairPlans.mockImplementation(async () => snapshots);
    runtime.appendRepairPlanSnapshot.mockImplementation(async (plan: RepairPlan) => {
      snapshots = [...snapshots.filter((item) => item.id !== plan.id), plan];
    });
    runtime.appendLearningEvidence.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not restart preparation when evidence changes after verification', async () => {
    const render = async () => {
      await act(async () => {
        root.render(
          createElement(RepairPanel, {
            component,
            evidence: [],
            isChinese: true,
            onClose: vi.fn(),
          }),
        );
      });
    };
    const click = async (label: string) => {
      const button = [...container.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === label,
      );
      expect(button, `button ${label}`).toBeDefined();
      await act(async () => button!.click());
    };

    await render();
    expect(runtime.readRepairPlans).toHaveBeenCalledTimes(1);
    await click('理解了，继续');
    await render();
    await click('理解了，继续');
    await render();
    await click(component.keyPoints[0]!);
    await click('提交验证');
    await render();

    expect(container.textContent).toContain('本轮补学已完成');
    expect(runtime.readRepairPlans).toHaveBeenCalledTimes(1);
    expect(snapshots.at(-1)?.status).toBe('completed');
  });
});

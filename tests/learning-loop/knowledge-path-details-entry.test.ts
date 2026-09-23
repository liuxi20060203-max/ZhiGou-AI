// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgePathSidebar } from '@/components/stage/knowledge-path-sidebar';

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  appendEvidence: vi.fn(async () => undefined),
  notify: vi.fn(),
  selectScene: vi.fn(),
  loopEnabled: true,
  sceneState: {
    stage: { id: 'stage' },
    scenes: [
      { id: 'scene-1', stageId: 'stage', title: '什么是小数？', type: 'slide', order: 0 },
      { id: 'scene-2', stageId: 'stage', title: '小数的读法', type: 'slide', order: 1 },
    ],
    outlines: [],
    currentSceneId: 'scene-1',
    setCurrentSceneId: vi.fn(),
    generatingOutlines: [],
    generationStatus: 'idle',
  },
}));

vi.mock('@/lib/store', () => ({
  useStageStore: Object.assign(() => mocks.sceneState, {
    use: { failedOutlines: () => [] },
  }),
  useCanvasStore: {
    use: { viewportSize: () => ({ width: 1024, height: 768 }), viewportRatio: () => 1 },
  },
}));
vi.mock('@/lib/config/feature-flags', () => ({
  isLearningLoopEnabled: () => mocks.loopEnabled,
}));
vi.mock('@/lib/hooks/use-i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', t: (key: string) => key }),
}));
vi.mock('@/lib/learning-loop/use-learning-journey', () => ({
  useLearningJourney: () => ({ evidence: [], error: false, refresh: async () => undefined }),
}));
vi.mock('@/lib/learning-loop/runtime', () => ({
  appendLearningEvidence: mocks.appendEvidence,
  notifyLearningJourneyChanged: mocks.notify,
}));
vi.mock('@/lib/learning-loop/analytics', () => ({ trackLearningLoopEvent: mocks.track }));
vi.mock('@/lib/learning-loop/save-authoring', () => ({ saveKnowledgeContent: vi.fn() }));
vi.mock('@/components/slide-renderer/SlideThumbnail', () => ({ SlideThumbnail: () => null }));
vi.mock('@/components/learning-loop/repair-panel', () => ({ RepairPanel: () => null }));
vi.mock('@/components/learning-loop/component-details-dialog', async () => {
  const { createElement } = await import('react');
  return {
    ComponentDetailsDialog: ({
      component,
      onClose,
    }: {
      component: { title: string };
      onClose: () => void;
    }) =>
      createElement(
        'div',
        { 'data-testid': 'knowledge-component-details' },
        component.title,
        createElement('button', { type: 'button', onClick: onClose }, '关闭详情'),
      ),
  };
});
vi.mock('@/components/ui/tooltip', async () => {
  const { createElement } = await import('react');
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, children);
  return {
    TooltipProvider: Wrapper,
    Tooltip: Wrapper,
    TooltipTrigger: Wrapper,
    TooltipContent: Wrapper,
  };
});

describe('knowledge path details entry', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.loopEnabled = true;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0));
    HTMLElement.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('separates scene navigation from the visible details action', async () => {
    await act(async () => {
      root.render(
        createElement(KnowledgePathSidebar, {
          collapsed: false,
          onCollapseChange: vi.fn(),
          onSceneSelect: mocks.selectScene,
        }),
      );
    });

    const details = container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="knowledge-component-details-trigger"]',
    );
    expect(details).toHaveLength(2);
    expect(details[0]?.textContent).toBe('详情');
    expect(details[0]?.getAttribute('aria-label')).toContain('学习目标与理解证据');
    expect(details[0]?.closest('button[data-testid="scene-item"]')).toBeNull();
    expect(details[0]?.parentElement?.querySelector('[data-testid="scene-item"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="knowledge-component-objective"]')).toBeNull();
    details[0]!.focus();
    await act(async () => details[0]!.click());
    expect(mocks.selectScene).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="knowledge-component-details"]')).not.toBeNull();
    expect(
      mocks.track.mock.calls.filter(([event]) => event.name === 'learning_loop_evidence_opened'),
    ).toHaveLength(1);

    const close = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '关闭详情',
    );
    await act(async () => close!.click());
    expect(document.activeElement).toBe(details[0]);
    expect(container.querySelector('[data-testid="knowledge-component-details"]')).toBeNull();

    await act(async () => details[0]!.click());

    const scenes = container.querySelectorAll<HTMLButtonElement>('[data-testid="scene-item"]');
    await act(async () => scenes[1]!.click());
    expect(mocks.selectScene).toHaveBeenCalledWith('scene-2');
    expect(container.querySelector('[data-testid="knowledge-component-details"]')).toBeNull();
  });

  it('keeps the collapsed path compact and navigable', async () => {
    await act(async () => {
      root.render(
        createElement(KnowledgePathSidebar, {
          collapsed: true,
          onCollapseChange: vi.fn(),
          onSceneSelect: mocks.selectScene,
        }),
      );
    });
    expect(
      container.querySelector('[data-testid="knowledge-component-details-trigger"]'),
    ).toBeNull();
    expect(container.textContent).toContain('展开路径可查看目标与证据');
    const scenes = container.querySelectorAll<HTMLButtonElement>('[data-testid="scene-item"]');
    await act(async () => scenes[1]!.click());
    expect(mocks.selectScene).toHaveBeenCalledWith('scene-2');
  });

  it('does not add the new details action when the feature flag is off', async () => {
    mocks.loopEnabled = false;
    await act(async () => {
      root.render(
        createElement(KnowledgePathSidebar, {
          collapsed: false,
          onCollapseChange: vi.fn(),
          onSceneSelect: mocks.selectScene,
        }),
      );
    });
    expect(
      container.querySelector('[data-testid="knowledge-component-details-trigger"]'),
    ).toBeNull();
    expect(container.querySelectorAll('[data-testid="scene-item"]')).toHaveLength(2);
  });
});

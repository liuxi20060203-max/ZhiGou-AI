import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveKnowledgeContent } from '@/lib/learning-loop/save-authoring';
import type { AuthoredKnowledgeContent } from '@/lib/learning-loop/types';

const mocks = vi.hoisted(() => ({
  enabled: true,
  state: {
    isOwner: true,
    readOnly: false,
    stage: { id: 'stage' },
    generatingOutlines: [] as unknown[],
    scenes: [
      {
        id: 'scene',
        stageId: 'stage',
        knowledgeContent: undefined as AuthoredKnowledgeContent | undefined,
      },
    ],
    updateScene: vi.fn(),
    saveToStorage: vi.fn(),
  },
}));
vi.mock('@/lib/store/stage', () => ({ useStageStore: { getState: () => mocks.state } }));
vi.mock('@/lib/config/feature-flags', () => ({ isLearningLoopEnabled: () => mocks.enabled }));
const input = { objective: 'Understand decimals', keyPoints: ['Place value'] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
  mocks.state.isOwner = true;
  mocks.state.readOnly = false;
  mocks.state.generatingOutlines = [];
  mocks.state.scenes[0]!.knowledgeContent = undefined;
  mocks.state.saveToStorage.mockResolvedValue(true);
});

describe('save knowledge content', () => {
  it('saves a validated scene annotation through course persistence', async () => {
    await saveKnowledgeContent('stage', 'scene', input);
    expect(mocks.state.updateScene).toHaveBeenCalledWith('scene', {
      knowledgeContent: expect.objectContaining({
        ...input,
        version: 1,
        revision: expect.any(String),
      }),
    });
    expect(mocks.state.saveToStorage).toHaveBeenCalledOnce();
  });
  it('rejects read-only, non-owner, disabled, generating, and stale scene edits before writing', async () => {
    mocks.state.readOnly = true;
    await expect(saveKnowledgeContent('stage', 'scene', input)).rejects.toThrow();
    mocks.state.readOnly = false;
    mocks.state.isOwner = false;
    await expect(saveKnowledgeContent('stage', 'scene', input)).rejects.toThrow();
    mocks.state.isOwner = true;
    mocks.enabled = false;
    await expect(saveKnowledgeContent('stage', 'scene', input)).rejects.toThrow();
    mocks.enabled = true;
    mocks.state.generatingOutlines = [{}];
    await expect(saveKnowledgeContent('stage', 'scene', input)).rejects.toThrow();
    mocks.state.generatingOutlines = [];
    await expect(saveKnowledgeContent('other', 'scene', input)).rejects.toThrow();
    await expect(saveKnowledgeContent('stage', 'deleted', input)).rejects.toThrow();
    expect(mocks.state.updateScene).not.toHaveBeenCalled();
  });
  it('does not report success when durable saving fails', async () => {
    mocks.state.saveToStorage.mockResolvedValue(false);
    await expect(saveKnowledgeContent('stage', 'scene', input)).rejects.toThrow('not confirmed');
  });
  it('preserves the content revision on unchanged saves and retries', async () => {
    mocks.state.scenes[0]!.knowledgeContent = {
      ...input,
      version: 1,
      revision: 'existing',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };
    await saveKnowledgeContent('stage', 'scene', input);
    expect(mocks.state.updateScene).not.toHaveBeenCalled();
    expect(mocks.state.saveToStorage).toHaveBeenCalledOnce();
  });
});

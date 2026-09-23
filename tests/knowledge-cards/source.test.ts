import { describe, expect, it } from 'vitest';
import { knowledgeCardDraft } from '@/lib/knowledge-cards/source';
import type { ChatSession } from '@/lib/types/chat';
import type { Scene } from '@/lib/types/stage';

const stage = { id: 'stage', name: 'Course', createdAt: 1, updatedAt: 1 };
const scene: Scene = {
  id: 'origin',
  stageId: 'stage',
  title: 'Origin block',
  order: 1,
  type: 'quiz',
  content: { type: 'quiz', questions: [] },
};
const session = { id: 'chat', type: 'qa', title: 'Question', sceneId: 'origin' } as ChatSession;
const message = {
  id: 'message',
  role: 'assistant' as const,
  parts: [
    { type: 'text' as const, text: 'Useful answer' },
    { type: 'reasoning' as const, text: 'Private reasoning' },
  ],
};
describe('knowledge card source', () => {
  it('uses the source scene and visible text only', () => {
    expect(
      knowledgeCardDraft(stage, [scene, { ...scene, id: 'current' }], session, message),
    ).toMatchObject({
      body: 'Useful answer',
      source: { sceneId: 'origin', componentId: 'kc:stage:origin' },
    });
  });
  it('keeps a missing source reference without attaching the currently viewed scene', () => {
    expect(
      knowledgeCardDraft(stage, [{ ...scene, id: 'current' }], session, message)?.source,
    ).toMatchObject({ sceneId: 'origin' });
    expect(knowledgeCardDraft(stage, [], session, message)?.source.componentId).toBeUndefined();
  });
  it('does not save interrupted, empty, or user question bubbles, but accepts discussion contributions', () => {
    expect(
      knowledgeCardDraft(stage, [], session, { ...message, metadata: { interrupted: true } }),
    ).toBeUndefined();
    expect(knowledgeCardDraft(stage, [], session, { ...message, parts: [] })).toBeUndefined();
    expect(knowledgeCardDraft(stage, [], session, { ...message, role: 'user' })).toBeUndefined();
    expect(
      knowledgeCardDraft(
        stage,
        [],
        { ...session, type: 'discussion' },
        { ...message, role: 'user' },
      ),
    ).toBeDefined();
  });
});

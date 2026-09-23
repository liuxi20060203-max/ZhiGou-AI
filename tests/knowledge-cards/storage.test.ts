import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { BrowserRuntimeStore } from '@openmaic/storage';
import { APP_RUNTIME_PAYLOAD_VALIDATORS } from '@/lib/runtime/payload-validators';
import {
  readKnowledgeCards,
  readAllKnowledgeCards,
  saveKnowledgeCard,
  deleteKnowledgeCard,
} from '@/lib/knowledge-cards/storage';
import { readLearningEvidence } from '@/lib/learning-loop/runtime';
import type { KnowledgeCardSource } from '@/lib/knowledge-cards/types';

const source: KnowledgeCardSource = {
  stageId: 'stage',
  stageTitle: 'Decimals',
  sceneId: 'scene',
  sceneTitle: 'Place value',
  componentId: 'kc:stage:scene',
  chatSessionId: 'discussion',
  messageId: 'message',
  speaker: 'Teacher',
  kind: 'discussion',
};
const input = {
  title: 'Place value',
  body: 'A digit has different values in different positions.',
};
function harness(indexedDB = new IDBFactory()) {
  return new BrowserRuntimeStore({
    indexedDB,
    dbName: 'knowledge-card-tests',
    payloadValidators: APP_RUNTIME_PAYLOAD_VALIDATORS,
  });
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: IDBKeyRange });
});

describe('knowledge card persistence', () => {
  it('aggregates courses without requiring tasks or duplicating courses, and keeps learner isolation', async () => {
    const deps = { store: harness(), learnerKey: 'learner' };
    await saveKnowledgeCard(source, input, undefined, deps);
    await saveKnowledgeCard(
      { ...source, stageId: 'free-course' },
      { ...input, title: 'Independent course' },
      undefined,
      deps,
    );
    await saveKnowledgeCard(source, { ...input, title: 'Private other learner card' }, undefined, {
      ...deps,
      learnerKey: 'other',
    });
    const cards = await readAllKnowledgeCards({
      ...deps,
      stageIds: ['stage', 'free-course', 'stage', 'empty'],
    });
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.source.stageId).sort()).toEqual(['free-course', 'stage']);
    expect(cards.some((card) => card.title === 'Private other learner card')).toBe(false);
    await deleteKnowledgeCard(cards[0]!, deps);
    expect(
      await readAllKnowledgeCards({ ...deps, stageIds: ['stage', 'free-course'] }),
    ).toHaveLength(1);
  });
  it('restores cards from a reopened store, edits them and physically deletes their history', async () => {
    const indexedDB = new IDBFactory();
    const deps = { store: harness(indexedDB), learnerKey: 'learner' };
    await saveKnowledgeCard(source, input, undefined, deps);
    const reopened = { ...deps, store: harness(indexedDB) };
    const [card] = await readKnowledgeCards('stage', reopened);
    expect(card).toMatchObject({ ...input, source });
    await saveKnowledgeCard(source, { ...input, title: 'Edited card' }, card, reopened);
    const [edited] = await readKnowledgeCards('stage', reopened);
    expect(edited?.title).toBe('Edited card');
    expect(await reopened.store.listRecords(card!.sessionId)).toHaveLength(2);
    await deleteKnowledgeCard(edited!, reopened);
    expect(await readKnowledgeCards('stage', reopened)).toEqual([]);
    expect(await reopened.store.listRecords(card!.sessionId)).toEqual([]);
    await expect(saveKnowledgeCard(source, input, edited, reopened)).rejects.toThrow('deleted');
  });
  it('rejects duplicate creates and stale edits instead of duplicating or overwriting cards', async () => {
    const deps = { store: harness(), learnerKey: 'learner' };
    const results = await Promise.allSettled([
      saveKnowledgeCard(source, input, undefined, deps),
      saveKnowledgeCard(source, input, undefined, deps),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [card] = await readKnowledgeCards('stage', deps);
    expect(await readKnowledgeCards('stage', deps)).toHaveLength(1);
    await saveKnowledgeCard(source, { ...input, title: 'Newest' }, card, deps);
    await expect(
      saveKnowledgeCard(source, { ...input, title: 'Stale' }, card, deps),
    ).rejects.toThrow('changed');
    expect((await readKnowledgeCards('stage', deps))[0]?.title).toBe('Newest');
  });
  it('isolates learners, emits no learning evidence, and follows learner merge and stage deletion', async () => {
    const store = harness();
    const anon = { store, learnerKey: 'anonymous' };
    const account = { store, learnerKey: 'account' };
    await saveKnowledgeCard(source, input, undefined, anon);
    const [card] = await readKnowledgeCards('stage', anon);
    expect(await readKnowledgeCards('stage', account)).toEqual([]);
    expect(await readKnowledgeCards('other-stage', anon)).toEqual([]);
    expect(await readLearningEvidence('stage', anon)).toEqual([]);
    await expect(deleteKnowledgeCard(card!, account)).rejects.toThrow('partition');
    await store.mergeLearner('anonymous', 'account');
    expect(await readKnowledgeCards('stage', account)).toHaveLength(1);
    expect(await readKnowledgeCards('stage', anon)).toEqual([]);
    await store.deleteStageRuntime('stage');
    expect(await readKnowledgeCards('stage', account)).toEqual([]);
  });
  it('rejects empty content before creating storage records', async () => {
    const deps = { store: harness(), learnerKey: 'learner' };
    await expect(
      saveKnowledgeCard(source, { title: ' ', body: '' }, undefined, deps),
    ).rejects.toThrow();
    expect(await deps.store.listSessions('stage', 'learner')).toEqual([]);
  });
});

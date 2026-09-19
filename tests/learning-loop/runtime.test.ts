import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { BrowserRuntimeStore } from '@openmaic/storage';

import { sceneVisitedEvidence } from '@/lib/learning-loop/evidence';
import {
  appendLearningEvidence,
  learningJourneyId,
  readLearningEvidence,
} from '@/lib/learning-loop/runtime';
import { APP_RUNTIME_PAYLOAD_VALIDATORS } from '@/lib/runtime/payload-validators';

describe('learning journey runtime', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'IDBKeyRange', {
      configurable: true,
      value: IDBKeyRange,
    });
  });

  function harness() {
    return new BrowserRuntimeStore({
      indexedDB: new IDBFactory(),
      dbName: `learning-journey-${Math.random()}`,
      payloadValidators: APP_RUNTIME_PAYLOAD_VALIDATORS,
    });
  }

  it('creates one deterministic learner journey and restores its evidence', async () => {
    const store = harness();
    const item = sceneVisitedEvidence({
      stageId: 'stage-1',
      sceneId: 'scene-1',
      componentId: 'kc:stage-1:scene-1',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });

    await appendLearningEvidence('stage-1', item, { store, learnerKey: 'learner-1' });

    expect(await store.getSession(learningJourneyId('stage-1', 'learner-1'))).toMatchObject({
      kind: 'learningJourney',
      stageId: 'stage-1',
      learnerKey: 'learner-1',
    });
    expect(await readLearningEvidence('stage-1', { store, learnerKey: 'learner-1' })).toEqual([
      expect.objectContaining({ eventId: item.eventId, learnerKey: 'learner-1' }),
    ]);
  });

  it('is idempotent when the same business event is retried', async () => {
    const store = harness();
    const item = sceneVisitedEvidence({
      stageId: 'stage-1',
      sceneId: 'scene-1',
      componentId: 'kc:stage-1:scene-1',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });

    await Promise.all([
      appendLearningEvidence('stage-1', item, { store, learnerKey: 'learner-1' }),
      appendLearningEvidence('stage-1', item, { store, learnerKey: 'learner-1' }),
    ]);

    expect(await readLearningEvidence('stage-1', { store, learnerKey: 'learner-1' })).toHaveLength(
      1,
    );
  });

  it('rejects malformed journey payloads at the store boundary', async () => {
    const store = harness();
    const sessionId = learningJourneyId('stage-1', 'learner-1');
    await store.createSession({
      id: sessionId,
      kind: 'learningJourney',
      stageId: 'stage-1',
      learnerKey: 'learner-1',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      store.appendRecord({
        id: 'bad',
        sessionId,
        createdAt: '2026-01-01T00:00:00.000Z',
        payload: { recordType: 'evidence' },
      }),
    ).rejects.toThrow(/learningJourney payload/);
  });
});

import { describe, expect, it } from 'vitest';
import { buildReviewWorkbench } from '@/lib/learning/review-workbench';
import type {
  KnowledgeModel,
  KnowledgeComponent,
  LearningEvidence,
} from '@/lib/learning-loop/types';
import type { LearningTask } from '@/lib/learning/types';
import type { KnowledgeCard } from '@/lib/knowledge-cards/types';

const component: KnowledgeComponent = {
  id: 'kc:s:a',
  stageId: 's',
  title: '小数',
  keyPoints: [],
  sceneIds: ['a'],
  prerequisiteIds: [],
  verification: { requiredEvidenceCount: 1, acceptedEvidenceTypes: ['verification_passed'] },
  source: 'scene-derived',
  version: 1,
};
const model = {
  stageId: 's',
  components: [component, { ...component, id: 'kc:s:b', sceneIds: ['b'] }],
} as KnowledgeModel;
const task = {
  id: 'task',
  classroomId: 's',
  reviewSceneIds: ['a'],
  notes: {
    a: { sceneId: 'a', content: '我的笔记', updatedAt: 1 },
    missing: { sceneId: 'deleted', content: '旧笔记', updatedAt: 1 },
  },
} as unknown as LearningTask;
const event = (
  type: 'learner_confusion' | 'verification_passed',
  at: number,
): LearningEvidence => ({
  eventId: `${type}-${at}`,
  stageId: 's',
  learnerKey: 'learner',
  componentId: component.id,
  type,
  source: type === 'learner_confusion' ? 'learner' : 'repair',
  strength: 'strong',
  outcome: type === 'learner_confusion' ? 'contradicts' : 'supports',
  occurredAt: new Date(at).toISOString(),
  payload: {},
  schemaVersion: 1,
});

describe('review workbench model', () => {
  it('separates unstarted from unresolved questions and keeps bookmarks independent', () => {
    const items = buildReviewWorkbench(model, [event('learner_confusion', 1)], [task], []);
    expect(items).toHaveLength(2);
    expect(items[0]?.group).toBe('pending');
    expect(items[0]?.markedTasks).toHaveLength(1);
    expect(items[1]?.group).toBe('not_started');
    const passed = buildReviewWorkbench(
      model,
      [event('learner_confusion', 1), event('verification_passed', 2)],
      [task],
      [],
    );
    expect(passed[0]?.state.status).toBe('verified');
    expect(passed[0]?.group).toBe('pending');
    const unmarked = buildReviewWorkbench(
      model,
      [event('verification_passed', 2)],
      [{ ...task, reviewSceneIds: [] }],
      [],
    );
    expect(unmarked[0]?.group).toBe('verified');
  });
  it('associates materials by course and scene/component identity, not title', () => {
    const card = {
      sessionId: 'card',
      source: { stageId: 's', componentId: component.id, sceneId: 'a' },
    } as KnowledgeCard;
    const items = buildReviewWorkbench(
      model,
      [],
      [task, { ...task, id: 'other', classroomId: 'other' }],
      [
        card,
        { ...card, source: { ...card.source, stageId: 'other' } },
        { ...card, source: { ...card.source, componentId: 'deleted' } },
      ],
    );
    expect(items[0]?.notes.map((note) => note.content)).toEqual(['我的笔记']);
    expect(items[0]?.cards).toEqual([card]);
    expect(items[1]?.notes).toEqual([]);
    expect(items[1]?.cards).toEqual([]);
    expect(items[0]?.state.status).toBe('not_started');
  });
  it('ignores other courses and old content revisions', () => {
    expect(
      buildReviewWorkbench(
        model,
        [{ ...event('verification_passed', 1), stageId: 'other' }],
        [],
        [],
      )[0]?.state.status,
    ).toBe('not_started');
    const revised = { ...model, components: [{ ...component, contentRevision: 'v2' }] };
    expect(
      buildReviewWorkbench(revised, [event('verification_passed', 1)], [], [])[0]?.state.status,
    ).toBe('not_started');
  });
  it('prioritizes unresolved questions over bookmarks without treating bookmarks as evidence', () => {
    const items = buildReviewWorkbench(
      model,
      [{ ...event('learner_confusion', 1), componentId: 'kc:s:b' }],
      [task],
      [],
    );
    expect(items.map((item) => item.component.id)).toEqual(['kc:s:b', 'kc:s:a']);
    expect(items[1]?.state.status).toBe('not_started');
  });
});

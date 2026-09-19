import { describe, expect, it } from 'vitest';

import { foldComponentLearningState } from '@/lib/learning-loop/fold';
import type { KnowledgeComponent, LearningEvidence } from '@/lib/learning-loop/types';

const component: KnowledgeComponent = {
  id: 'kc:stage:scene',
  stageId: 'stage',
  title: 'Concept',
  keyPoints: [],
  sceneIds: ['scene'],
  prerequisiteIds: [],
  verification: {
    requiredEvidenceCount: 1,
    acceptedEvidenceTypes: ['quiz_reviewed', 'verification_passed', 'verification_failed'],
  },
  source: 'scene-derived',
  version: 1,
};

function evidence(eventId: string, overrides: Partial<LearningEvidence> = {}): LearningEvidence {
  return {
    eventId,
    stageId: 'stage',
    learnerKey: 'learner',
    componentId: component.id,
    sceneId: 'scene',
    type: 'scene_visited',
    outcome: 'neutral',
    strength: 'weak',
    source: 'playback',
    payload: {},
    occurredAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 1,
    ...overrides,
  };
}

describe('foldComponentLearningState', () => {
  it('uses explicit discrete states without inferring understanding from a visit', () => {
    expect(foldComponentLearningState(component, []).status).toBe('not_started');
    expect(foldComponentLearningState(component, [evidence('visit')]).status).toBe('in_progress');
  });

  it('marks an explicit confusion or incorrect quiz as needs_revisit', () => {
    expect(
      foldComponentLearningState(component, [
        evidence('confused', {
          type: 'learner_confusion',
          outcome: 'contradicts',
          strength: 'medium',
          source: 'learner',
        }),
      ]).status,
    ).toBe('needs_revisit');
  });

  it('verifies an all-correct latest quiz attempt', () => {
    const events = ['q1', 'q2'].map((id) =>
      evidence(id, {
        type: 'quiz_reviewed',
        outcome: 'supports',
        strength: 'strong',
        source: 'quiz',
        payload: { attemptId: 'attempt-1', questionId: id },
      }),
    );
    expect(foldComponentLearningState(component, events).status).toBe('verified');
  });

  it('keeps a mixed quiz attempt at needs_revisit regardless of event id ordering', () => {
    const events = [
      evidence('z-correct', {
        type: 'quiz_reviewed',
        outcome: 'supports',
        strength: 'strong',
        source: 'quiz',
        payload: { attemptId: 'attempt-1', questionId: 'q1' },
      }),
      evidence('a-wrong', {
        type: 'quiz_reviewed',
        outcome: 'contradicts',
        strength: 'strong',
        source: 'quiz',
        payload: { attemptId: 'attempt-1', questionId: 'q2' },
      }),
    ];
    expect(foldComponentLearningState(component, events).status).toBe('needs_revisit');
  });

  it('allows a later verification pass to resolve an earlier contradiction', () => {
    const events = [
      evidence('wrong', {
        type: 'verification_failed',
        outcome: 'contradicts',
        strength: 'strong',
      }),
      evidence('pass', {
        type: 'verification_passed',
        outcome: 'supports',
        strength: 'strong',
        occurredAt: '2026-01-01T00:01:00.000Z',
      }),
    ];
    expect(foldComponentLearningState(component, events).status).toBe('verified');
  });

  it('deduplicates retried event ids', () => {
    const duplicate = evidence('visit');
    expect(foldComponentLearningState(component, [duplicate, duplicate]).evidence).toHaveLength(1);
  });
});

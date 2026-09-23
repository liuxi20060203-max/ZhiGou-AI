import type { QuestionResult } from '@/lib/quiz/grading';

import type {
  LearningEvidencePayload,
  LearningEvidenceSource,
  LearningEvidenceType,
} from './types';

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function sceneVisitedEvidence(input: {
  stageId: string;
  sceneId: string;
  componentId: string;
  occurredAt: string;
  componentRevision?: string;
}): LearningEvidencePayload {
  return {
    eventId: `visit:${segment(input.stageId)}:${segment(input.sceneId)}${input.componentRevision ? `:${segment(input.componentRevision)}` : ''}`,
    componentId: input.componentId,
    sceneId: input.sceneId,
    type: 'scene_visited',
    outcome: 'neutral',
    strength: 'weak',
    source: 'playback',
    payload: input.componentRevision ? { componentRevision: input.componentRevision } : {},
    occurredAt: input.occurredAt,
    schemaVersion: 1,
  };
}

export function learnerConfusionEvidence(input: {
  eventId: string;
  sceneId: string;
  componentId: string;
  occurredAt: string;
  componentRevision?: string;
}): LearningEvidencePayload {
  return {
    eventId: input.eventId,
    componentId: input.componentId,
    sceneId: input.sceneId,
    type: 'learner_confusion',
    outcome: 'contradicts',
    strength: 'medium',
    source: 'learner',
    payload: input.componentRevision ? { componentRevision: input.componentRevision } : {},
    occurredAt: input.occurredAt,
    schemaVersion: 1,
  };
}

export function quizReviewedEvidence(input: {
  attemptId: string;
  sceneId: string;
  componentId: string;
  result: QuestionResult;
  occurredAt: string;
}): LearningEvidencePayload {
  const correct = input.result.status === 'correct';
  return {
    eventId: `quiz:${segment(input.attemptId)}:${segment(input.result.questionId)}:reviewed`,
    componentId: input.componentId,
    sceneId: input.sceneId,
    type: 'quiz_reviewed',
    outcome: correct ? 'supports' : 'contradicts',
    strength: 'strong',
    source: 'quiz',
    payload: {
      attemptId: input.attemptId,
      questionId: input.result.questionId,
      status: input.result.status,
      earned: input.result.earned,
    },
    occurredAt: input.occurredAt,
    schemaVersion: 1,
  };
}

export function quizReviewEvidenceAttemptId(
  attemptId: string,
  results: readonly QuestionResult[],
): string {
  const fingerprint = results
    .map((result) => `${result.questionId}=${result.status}:${result.earned}`)
    .join(',');
  return `${attemptId}:review:${fingerprint}`;
}

export const LEARNING_EVIDENCE_TYPES = new Set<LearningEvidenceType>([
  'scene_visited',
  'quiz_reviewed',
  'learner_confusion',
  'learner_explanation',
  'repair_step_completed',
  'verification_passed',
  'verification_failed',
]);

export const LEARNING_EVIDENCE_SOURCES = new Set<LearningEvidenceSource>([
  'playback',
  'quiz',
  'learner',
  'tutor',
  'repair',
]);

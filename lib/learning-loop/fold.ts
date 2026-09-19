import type { KnowledgeComponent, LearningComponentStatus, LearningEvidence } from './types';

export interface ComponentLearningState {
  componentId: string;
  status: LearningComponentStatus;
  evidence: LearningEvidence[];
}

function eventTime(event: LearningEvidence): number {
  const parsed = Date.parse(event.occurredAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueOrderedEvidence(events: readonly LearningEvidence[]): LearningEvidence[] {
  const unique = new Map<string, LearningEvidence>();
  for (const event of events) {
    if (!unique.has(event.eventId)) unique.set(event.eventId, event);
  }
  return [...unique.values()].sort(
    (left, right) =>
      eventTime(left) - eventTime(right) || left.eventId.localeCompare(right.eventId),
  );
}

function latestQuizAttempt(events: readonly LearningEvidence[]): LearningEvidence[] {
  const attempts = new Map<string, LearningEvidence[]>();
  for (const event of events) {
    if (event.type !== 'quiz_reviewed') continue;
    const attemptId = event.payload.attemptId;
    if (typeof attemptId !== 'string') continue;
    const group = attempts.get(attemptId) ?? [];
    group.push(event);
    attempts.set(attemptId, group);
  }
  return (
    [...attempts.values()]
      .sort((left, right) => {
        const leftTime = Math.max(...left.map(eventTime));
        const rightTime = Math.max(...right.map(eventTime));
        return leftTime - rightTime;
      })
      .at(-1) ?? []
  );
}

export function foldComponentLearningState(
  component: KnowledgeComponent,
  allEvidence: readonly LearningEvidence[],
): ComponentLearningState {
  const evidence = uniqueOrderedEvidence(
    allEvidence.filter((event) => event.componentId === component.id),
  );
  if (evidence.length === 0) return { componentId: component.id, status: 'not_started', evidence };

  const latestContradiction = [...evidence]
    .reverse()
    .find((event) => event.outcome === 'contradicts');
  const latestVerificationPass = [...evidence]
    .reverse()
    .find((event) => event.type === 'verification_passed');
  if (
    latestContradiction &&
    (!latestVerificationPass || eventTime(latestVerificationPass) <= eventTime(latestContradiction))
  ) {
    const latestAttempt = latestQuizAttempt(evidence);
    const attemptAfterContradiction =
      latestAttempt.length > 0 &&
      Math.min(...latestAttempt.map(eventTime)) > eventTime(latestContradiction);
    const latestAttemptPassed =
      attemptAfterContradiction && latestAttempt.every((event) => event.outcome === 'supports');
    if (!latestAttemptPassed) {
      return { componentId: component.id, status: 'needs_revisit', evidence };
    }
  }

  if (latestVerificationPass) {
    return { componentId: component.id, status: 'verified', evidence };
  }
  const quizAttempt = latestQuizAttempt(evidence);
  if (
    quizAttempt.length >= component.verification.requiredEvidenceCount &&
    quizAttempt.every((event) => event.outcome === 'supports')
  ) {
    return { componentId: component.id, status: 'verified', evidence };
  }
  if (evidence.every((event) => event.strength === 'weak')) {
    return { componentId: component.id, status: 'in_progress', evidence };
  }
  return { componentId: component.id, status: 'evidence_available', evidence };
}

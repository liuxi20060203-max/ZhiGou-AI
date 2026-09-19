import type { RuntimePayloadValidator } from '@openmaic/storage';

import { LEARNING_EVIDENCE_SOURCES, LEARNING_EVIDENCE_TYPES } from './evidence';
import type { LearningEvidenceRecordPayload } from './types';

function invalid(message: string): ReturnType<RuntimePayloadValidator> {
  return { valid: false, errors: [{ path: '/payload', message }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLearningEvidenceRecordPayload(
  payload: unknown,
): payload is LearningEvidenceRecordPayload {
  if (!isRecord(payload) || payload.payloadVersion !== 1 || payload.recordType !== 'evidence') {
    return false;
  }
  const evidence = payload.evidence;
  if (!isRecord(evidence)) return false;
  return (
    evidence.schemaVersion === 1 &&
    typeof evidence.eventId === 'string' &&
    evidence.eventId.length > 0 &&
    typeof evidence.componentId === 'string' &&
    evidence.componentId.length > 0 &&
    (evidence.sceneId === undefined || typeof evidence.sceneId === 'string') &&
    typeof evidence.type === 'string' &&
    LEARNING_EVIDENCE_TYPES.has(evidence.type as never) &&
    (evidence.outcome === 'neutral' ||
      evidence.outcome === 'supports' ||
      evidence.outcome === 'contradicts') &&
    (evidence.strength === 'weak' ||
      evidence.strength === 'medium' ||
      evidence.strength === 'strong') &&
    typeof evidence.source === 'string' &&
    LEARNING_EVIDENCE_SOURCES.has(evidence.source as never) &&
    isRecord(evidence.payload) &&
    typeof evidence.occurredAt === 'string' &&
    Number.isFinite(Date.parse(evidence.occurredAt))
  );
}

export const learningJourneyPayloadValidator: RuntimePayloadValidator = (payload) =>
  isLearningEvidenceRecordPayload(payload)
    ? { valid: true }
    : invalid('learningJourney payload must be a supported versioned evidence record');

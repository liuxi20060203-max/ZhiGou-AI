import type { RuntimePayloadValidator } from '@openmaic/storage';
import { knowledgeCardPayloadSchema } from '@/lib/knowledge-cards/types';

import { LEARNING_EVIDENCE_SOURCES, LEARNING_EVIDENCE_TYPES } from './evidence';
import { isValidRepairPlan } from './repair-plan';
import type {
  LearningEvidenceRecordPayload,
  LearningJourneyRecordPayload,
  RepairPlan,
  RepairPlanRecordPayload,
} from './types';

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

export function isRepairPlanRecordPayload(payload: unknown): payload is RepairPlanRecordPayload {
  if (!isRecord(payload) || payload.payloadVersion !== 1 || payload.recordType !== 'repair_plan') {
    return false;
  }
  const plan = payload.plan;
  if (
    !isRecord(plan) ||
    typeof plan.id !== 'string' ||
    typeof plan.stageId !== 'string' ||
    typeof plan.componentId !== 'string' ||
    (plan.componentRevision !== undefined && typeof plan.componentRevision !== 'string') ||
    !Array.isArray(plan.triggerEvidenceIds) ||
    !plan.triggerEvidenceIds.every((id) => typeof id === 'string') ||
    typeof plan.rationale !== 'string' ||
    !Array.isArray(plan.steps) ||
    !['proposed', 'active', 'completed', 'dismissed', 'expired'].includes(String(plan.status)) ||
    plan.contentVersion !== 1 ||
    typeof plan.createdAt !== 'string' ||
    typeof plan.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(plan.createdAt)) ||
    !Number.isFinite(Date.parse(plan.updatedAt))
  ) {
    return false;
  }
  try {
    return isValidRepairPlan(plan as unknown as RepairPlan);
  } catch {
    return false;
  }
}

export function isLearningJourneyRecordPayload(
  payload: unknown,
): payload is LearningJourneyRecordPayload {
  return isLearningEvidenceRecordPayload(payload) || isRepairPlanRecordPayload(payload);
}

export const learningJourneyPayloadValidator: RuntimePayloadValidator = (payload) =>
  isLearningJourneyRecordPayload(payload) || knowledgeCardPayloadSchema.safeParse(payload).success
    ? { valid: true }
    : invalid('learningJourney payload must be a supported versioned journey record');

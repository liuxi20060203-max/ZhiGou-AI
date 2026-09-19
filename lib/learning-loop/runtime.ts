import type { RuntimeRecord, RuntimeSession } from '@openmaic/dsl';
import { RuntimeAppendConflictError, type RuntimeStore } from '@openmaic/storage';

import { getLearnerKey } from '@/lib/runtime/learner-key';
import { getRuntimeStore } from '@/lib/runtime/store';

import type {
  LearningEvidence,
  LearningEvidencePayload,
  LearningEvidenceRecordPayload,
  RepairPlan,
  RepairPlanRecordPayload,
} from './types';
import { isLearningEvidenceRecordPayload, isRepairPlanRecordPayload } from './validators';

export interface LearningJourneyRuntimeDeps {
  store?: RuntimeStore;
  learnerKey?: string;
  now?: () => string;
}

const queues = new WeakMap<RuntimeStore, Map<string, Promise<unknown>>>();

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function learningJourneyId(stageId: string, learnerKey: string): string {
  return `learning-journey:${segment(stageId)}:${segment(learnerKey)}`;
}

function enqueue<T>(store: RuntimeStore, sessionId: string, work: () => Promise<T>): Promise<T> {
  const storeQueues = queues.get(store) ?? new Map<string, Promise<unknown>>();
  queues.set(store, storeQueues);
  const previous = storeQueues.get(sessionId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  storeQueues.set(sessionId, next);
  void next.finally(() => {
    if (storeQueues.get(sessionId) === next) storeQueues.delete(sessionId);
  });
  return next;
}

function assertJourneyPartition(
  session: RuntimeSession,
  stageId: string,
  learnerKey: string,
): void {
  if (
    session.kind !== 'learningJourney' ||
    session.stageId !== stageId ||
    session.learnerKey !== learnerKey ||
    session.status !== 'active'
  ) {
    throw new Error(`Learning journey ${JSON.stringify(session.id)} has an invalid partition`);
  }
}

function evidenceFromRecord(
  session: RuntimeSession,
  record: RuntimeRecord,
): LearningEvidence | undefined {
  if (!isLearningEvidenceRecordPayload(record.payload)) return undefined;
  return {
    ...record.payload.evidence,
    stageId: session.stageId,
    learnerKey: session.learnerKey,
  };
}

export async function appendLearningEvidence(
  stageId: string,
  evidence: LearningEvidencePayload,
  deps: LearningJourneyRuntimeDeps = {},
): Promise<LearningEvidence> {
  const store = deps.store ?? getRuntimeStore();
  const learnerKey = deps.learnerKey ?? (await getLearnerKey());
  const sessionId = learningJourneyId(stageId, learnerKey);

  return enqueue(store, sessionId, async () => {
    while (true) {
      const timestamp = deps.now?.() ?? new Date().toISOString();
      let session = await store.getSession(sessionId);
      if (!session) {
        try {
          session = await store.createSession({
            id: sessionId,
            kind: 'learningJourney',
            stageId,
            learnerKey,
            status: 'active',
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        } catch (error) {
          session = await store.getSession(sessionId);
          if (!session) throw error;
        }
      }
      assertJourneyPartition(session, stageId, learnerKey);
      const records = await store.listRecords(sessionId);
      const existing = records.find((record) => record.id === evidence.eventId);
      if (existing) {
        const parsed = evidenceFromRecord(session, existing);
        if (!parsed)
          throw new Error(`Learning evidence ${JSON.stringify(evidence.eventId)} is invalid`);
        return parsed;
      }
      const payload: LearningEvidenceRecordPayload = {
        payloadVersion: 1,
        recordType: 'evidence',
        evidence,
      };
      try {
        const appended = await store.appendRecord(
          {
            id: evidence.eventId,
            sessionId,
            ...(evidence.sceneId ? { sceneId: evidence.sceneId } : {}),
            createdAt: evidence.occurredAt,
            payload,
          },
          { expectedLastSeq: records.at(-1)?.seq ?? null },
        );
        return evidenceFromRecord(session, appended)!;
      } catch (error) {
        if (error instanceof RuntimeAppendConflictError) continue;
        throw error;
      }
    }
  });
}

export async function readLearningEvidence(
  stageId: string,
  deps: LearningJourneyRuntimeDeps = {},
): Promise<LearningEvidence[]> {
  const store = deps.store ?? getRuntimeStore();
  const learnerKey = deps.learnerKey ?? (await getLearnerKey());
  const sessions = (await store.listSessions(stageId, learnerKey)).filter(
    (session) => session.kind === 'learningJourney',
  );
  const byEventId = new Map<string, LearningEvidence>();
  for (const session of sessions) {
    for (const record of await store.listRecords(session.id)) {
      const evidence = evidenceFromRecord(session, record);
      if (evidence && !byEventId.has(evidence.eventId)) byEventId.set(evidence.eventId, evidence);
    }
  }
  return [...byEventId.values()].sort(
    (left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
      left.eventId.localeCompare(right.eventId),
  );
}

export async function recordQuizReviewedEvidence(input: {
  stageId: string;
  sceneId: string;
  componentId: string;
  attemptId: string;
  evidence: LearningEvidencePayload[];
}): Promise<void> {
  await Promise.all(
    input.evidence.map((evidence) => appendLearningEvidence(input.stageId, evidence)),
  );
  notifyLearningJourneyChanged(input.stageId);
}

export async function appendRepairPlanSnapshot(
  plan: RepairPlan,
  deps: LearningJourneyRuntimeDeps = {},
): Promise<void> {
  const store = deps.store ?? getRuntimeStore();
  const learnerKey = deps.learnerKey ?? (await getLearnerKey());
  const sessionId = learningJourneyId(plan.stageId, learnerKey);
  const recordId = `repair-plan:${segment(plan.id)}:${segment(plan.updatedAt)}:${plan.status}`;
  await enqueue(store, sessionId, async () => {
    while (true) {
      let session = await store.getSession(sessionId);
      if (!session) {
        try {
          session = await store.createSession({
            id: sessionId,
            kind: 'learningJourney',
            stageId: plan.stageId,
            learnerKey,
            status: 'active',
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
          });
        } catch (error) {
          session = await store.getSession(sessionId);
          if (!session) throw error;
        }
      }
      assertJourneyPartition(session, plan.stageId, learnerKey);
      const records = await store.listRecords(sessionId);
      if (records.some((record) => record.id === recordId)) return;
      const payload: RepairPlanRecordPayload = {
        payloadVersion: 1,
        recordType: 'repair_plan',
        plan,
      };
      try {
        await store.appendRecord(
          {
            id: recordId,
            sessionId,
            sceneId: undefined,
            createdAt: plan.updatedAt,
            payload,
          },
          { expectedLastSeq: records.at(-1)?.seq ?? null },
        );
        notifyLearningJourneyChanged(plan.stageId);
        return;
      } catch (error) {
        if (error instanceof RuntimeAppendConflictError) continue;
        throw error;
      }
    }
  });
}

export async function readRepairPlans(
  stageId: string,
  deps: LearningJourneyRuntimeDeps = {},
): Promise<RepairPlan[]> {
  const store = deps.store ?? getRuntimeStore();
  const learnerKey = deps.learnerKey ?? (await getLearnerKey());
  const sessions = (await store.listSessions(stageId, learnerKey)).filter(
    (session) => session.kind === 'learningJourney',
  );
  const latest = new Map<string, RepairPlan>();
  for (const session of sessions) {
    for (const record of await store.listRecords(session.id)) {
      if (!isRepairPlanRecordPayload(record.payload)) continue;
      const candidate = record.payload.plan;
      const current = latest.get(candidate.id);
      if (!current || Date.parse(candidate.updatedAt) >= Date.parse(current.updatedAt)) {
        latest.set(candidate.id, candidate);
      }
    }
  }
  return [...latest.values()].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

export const LEARNING_JOURNEY_CHANGED_EVENT = 'openmaic:learning-journey-changed';

export function notifyLearningJourneyChanged(stageId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LEARNING_JOURNEY_CHANGED_EVENT, { detail: { stageId } }));
}

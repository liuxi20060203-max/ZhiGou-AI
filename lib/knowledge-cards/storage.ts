import { RuntimeAppendConflictError, type RuntimeStore } from '@openmaic/storage';
import { getRuntimeStore } from '@/lib/runtime/store';
import { getLearnerKey } from '@/lib/runtime/learner-key';
import {
  knowledgeCardInputSchema,
  knowledgeCardPayloadSchema,
  knowledgeCardSourceSchema,
  sameKnowledgeCardSource,
  type KnowledgeCard,
  type KnowledgeCardInput,
  type KnowledgeCardSource,
} from './types';

export interface KnowledgeCardStorageDeps {
  store?: RuntimeStore;
  learnerKey?: string;
}
export const KNOWLEDGE_CARDS_CHANGED = 'zhigou:knowledge-cards-changed';
/** Enumerate courses, but always read runtime data in the current learner partition. */
export async function readAllKnowledgeCards(
  deps: KnowledgeCardStorageDeps & { stageIds?: string[] } = {},
): Promise<KnowledgeCard[]> {
  const stageIds =
    deps.stageIds ??
    (await (await import('@/lib/utils/stage-storage')).listStages()).map((stage) => stage.id);
  const resolved = await context(deps);
  const groups = await Promise.all(
    [...new Set(stageIds)].map((id) => readKnowledgeCards(id, resolved)),
  );
  return groups.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
async function context(deps: KnowledgeCardStorageDeps) {
  return {
    store: deps.store ?? getRuntimeStore(),
    learnerKey: deps.learnerKey ?? (await getLearnerKey()),
  };
}
function changed(stageId: string) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_CARDS_CHANGED, { detail: { stageId } }));
}
export async function readKnowledgeCards(
  stageId: string,
  deps: KnowledgeCardStorageDeps = {},
): Promise<KnowledgeCard[]> {
  const { store, learnerKey } = await context(deps);
  const cards: KnowledgeCard[] = [];
  for (const session of await store.listSessions(stageId, learnerKey)) {
    if (session.kind !== 'learningJourney' || !session.id.startsWith('knowledge-card:')) continue;
    const latest = (await store.listRecords(session.id)).at(-1);
    const parsed = knowledgeCardPayloadSchema.safeParse(latest?.payload);
    if (latest && parsed.success && parsed.data.source.stageId === stageId)
      cards.push({ ...parsed.data, sessionId: session.id, seq: latest.seq });
  }
  return cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
/** One dedicated runtime session per source; saving a card never emits learning evidence. */
export async function saveKnowledgeCard(
  source: KnowledgeCardSource,
  input: KnowledgeCardInput,
  existing?: KnowledgeCard,
  deps: KnowledgeCardStorageDeps = {},
): Promise<void> {
  const validSource = knowledgeCardSourceSchema.parse(source);
  const content = knowledgeCardInputSchema.parse(input);
  const { store, learnerKey } = await context(deps);
  if (existing && !sameKnowledgeCardSource(existing.source, source))
    throw new Error('Card source mismatch');
  const sessionId =
    existing?.sessionId ??
    `knowledge-card:${[source.stageId, learnerKey, source.chatSessionId, source.messageId].map(encodeURIComponent).join(':')}`;
  let session = await store.getSession(sessionId);
  const now = new Date(
    Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0),
  ).toISOString();
  if (!session) {
    if (existing) throw new Error('Card was deleted; reload the list');
    try {
      session = await store.createSession({
        id: sessionId,
        kind: 'learningJourney',
        stageId: source.stageId,
        learnerKey,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      session = await store.getSession(sessionId);
      if (!session) throw error;
    }
  }
  if (
    session.stageId !== source.stageId ||
    session.learnerKey !== learnerKey ||
    session.kind !== 'learningJourney' ||
    !session.id.startsWith('knowledge-card:')
  )
    throw new Error('Card partition mismatch');
  try {
    await store.appendRecord(
      {
        id: `card:${crypto.randomUUID()}`,
        sessionId,
        createdAt: now,
        payload: {
          payloadVersion: 1,
          recordType: 'knowledge_card',
          source: validSource,
          ...content,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
      },
      { expectedLastSeq: existing?.seq ?? null },
    );
  } catch (error) {
    if (error instanceof RuntimeAppendConflictError)
      throw new Error('Card changed in another view; reopen it before saving');
    throw error;
  }
  changed(source.stageId);
}
/** Deletes the card and its saved revisions, leaving the original chat untouched. */
export async function deleteKnowledgeCard(
  card: KnowledgeCard,
  deps: KnowledgeCardStorageDeps = {},
): Promise<void> {
  const { store, learnerKey } = await context(deps);
  const session = await store.getSession(card.sessionId);
  if (!session) {
    changed(card.source.stageId);
    return;
  }
  if (
    session.stageId !== card.source.stageId ||
    session.learnerKey !== learnerKey ||
    session.kind !== 'learningJourney' ||
    !session.id.startsWith('knowledge-card:')
  )
    throw new Error('Card partition mismatch');
  await store.deleteSession(card.sessionId);
  changed(card.source.stageId);
}

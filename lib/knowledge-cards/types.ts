import { z } from 'zod';

export const knowledgeCardSourceSchema = z.object({
  stageId: z.string().min(1),
  stageTitle: z.string(),
  sceneId: z.string().optional(),
  sceneTitle: z.string().optional(),
  componentId: z.string().optional(),
  chatSessionId: z.string().min(1),
  messageId: z.string().min(1),
  speaker: z.string(),
  kind: z.enum(['qa', 'discussion']),
});
export const knowledgeCardInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20000),
});
export const knowledgeCardPayloadSchema = z.object({
  payloadVersion: z.literal(1),
  recordType: z.literal('knowledge_card'),
  source: knowledgeCardSourceSchema,
  title: knowledgeCardInputSchema.shape.title,
  body: knowledgeCardInputSchema.shape.body,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KnowledgeCardSource = z.infer<typeof knowledgeCardSourceSchema>;
export type KnowledgeCardInput = z.infer<typeof knowledgeCardInputSchema>;
export type KnowledgeCardPayload = z.infer<typeof knowledgeCardPayloadSchema>;
export type KnowledgeCard = KnowledgeCardPayload & { sessionId: string; seq: number };

export function sameKnowledgeCardSource(a: KnowledgeCardSource, b: KnowledgeCardSource): boolean {
  return (
    a.stageId === b.stageId && a.chatSessionId === b.chatSessionId && a.messageId === b.messageId
  );
}

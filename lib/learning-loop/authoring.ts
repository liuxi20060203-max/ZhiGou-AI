import { z } from 'zod';

import type { AuthoredKnowledgeContent, KnowledgeComponent, RepairPlan } from './types';

export const repairVerificationSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
    correctIndex: z.number().int().min(0),
    explanation: z.string().trim().min(1).max(2000),
  })
  .refine((value) => value.correctIndex < value.options.length, 'Select a valid answer')
  .refine((value) => new Set(value.options).size === value.options.length, 'Options must differ');

export const knowledgeContentInputSchema = z
  .object({
    objective: z.string().trim().min(1).max(2000),
    keyPoints: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    verification: repairVerificationSchema.optional(),
  })
  .refine(
    (value) => new Set(value.keyPoints).size === value.keyPoints.length,
    'Key points must differ',
  );

export type KnowledgeContentInput = z.infer<typeof knowledgeContentInputSchema>;

const authoredSchema = knowledgeContentInputSchema.and(
  z.object({
    version: z.literal(1),
    revision: z.string().min(1).max(100),
    updatedAt: z.string().datetime(),
  }),
);

export function readAuthoredKnowledgeContent(value: unknown): AuthoredKnowledgeContent | undefined {
  const result = authoredSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

/** Keep the creator's question/answer intact even when AI rewrites the explanation. */
export function applyAuthoredVerification(
  plan: RepairPlan,
  component: KnowledgeComponent,
): RepairPlan {
  if (!component.authoredVerification) return plan;
  return {
    ...plan,
    steps: plan.steps.map((step) =>
      step.type === 'verification'
        ? { ...step, verification: component.authoredVerification }
        : step,
    ),
  };
}

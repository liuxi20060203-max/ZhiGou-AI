import { describe, expect, it } from 'vitest';

import { buildTemplateRepairPlan, isValidRepairPlan } from '@/lib/learning-loop/repair-plan';
import type { KnowledgeComponent, LearningEvidence } from '@/lib/learning-loop/types';

const component: KnowledgeComponent = {
  id: 'kc:stage:scene',
  stageId: 'stage',
  title: '闭包',
  objective: '解释闭包如何捕获外层变量',
  keyPoints: ['函数可以访问其词法作用域中的变量', '捕获的变量会随闭包保留'],
  sceneIds: ['scene'],
  prerequisiteIds: [],
  verification: { requiredEvidenceCount: 1, acceptedEvidenceTypes: ['verification_passed'] },
  source: 'outline-derived',
  version: 1,
};

const wrongEvidence: LearningEvidence = {
  eventId: 'quiz:wrong',
  stageId: 'stage',
  learnerKey: 'learner',
  componentId: component.id,
  sceneId: 'scene',
  type: 'quiz_reviewed',
  outcome: 'contradicts',
  strength: 'strong',
  source: 'quiz',
  payload: { attemptId: 'attempt' },
  occurredAt: '2026-01-01T00:00:00.000Z',
  schemaVersion: 1,
};

describe('repair plan', () => {
  it('builds a complete three-step fallback with a traceable rationale', () => {
    const plan = buildTemplateRepairPlan({
      component,
      evidence: [wrongEvidence],
      now: '2026-01-01T00:01:00.000Z',
      id: 'repair-1',
    });

    expect(plan.triggerEvidenceIds).toEqual(['quiz:wrong']);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((step) => step.type)).toEqual(['explanation', 'example', 'verification']);
    expect(isValidRepairPlan(plan)).toBe(true);
  });

  it('rejects plans without a usable verification or with more than three steps', () => {
    const plan = buildTemplateRepairPlan({ component, evidence: [], id: 'repair-1' });
    expect(isValidRepairPlan({ ...plan, steps: plan.steps.slice(0, 2) })).toBe(false);
    expect(isValidRepairPlan({ ...plan, steps: [...plan.steps, plan.steps[0]!] })).toBe(false);
    expect(
      isValidRepairPlan({
        ...plan,
        steps: plan.steps.map((step) =>
          step.type === 'verification'
            ? { ...step, verification: { ...step.verification!, correctIndex: 99 } }
            : step,
        ),
      }),
    ).toBe(false);
  });
});

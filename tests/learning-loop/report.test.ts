import { describe, expect, it } from 'vitest';

import { buildKnowledgeConstructionReport } from '@/lib/learning-loop/report';
import { buildTutorLearningContext } from '@/lib/learning-loop/tutor-context';
import type { KnowledgeModel, LearningEvidence, RepairPlan } from '@/lib/learning-loop/types';
import type { Scene, Stage } from '@/lib/types/stage';

const stage: Stage = { id: 'stage', name: 'Course', createdAt: 1, updatedAt: 1 };
const scene = {
  id: 'scene',
  stageId: 'stage',
  type: 'slide',
  title: 'Concept',
  order: 1,
  content: { type: 'slide', canvas: {} },
} as Scene;
const model: KnowledgeModel = {
  stageId: 'stage',
  version: 1,
  components: [
    {
      id: 'kc:stage:scene',
      stageId: 'stage',
      title: 'Concept',
      keyPoints: [],
      sceneIds: ['scene'],
      prerequisiteIds: [],
      verification: { requiredEvidenceCount: 1, acceptedEvidenceTypes: ['verification_passed'] },
      source: 'scene-derived',
      version: 1,
    },
  ],
};

function evidence(overrides: Partial<LearningEvidence> = {}): LearningEvidence {
  return {
    eventId: 'event',
    stageId: 'stage',
    learnerKey: 'learner',
    componentId: 'kc:stage:scene',
    sceneId: 'scene',
    type: 'verification_passed',
    outcome: 'supports',
    strength: 'strong',
    source: 'repair',
    payload: {},
    occurredAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 1,
    ...overrides,
  };
}

describe('knowledge construction report', () => {
  it('reports only evidence-derived statuses and identifies repaired components', () => {
    const report = buildKnowledgeConstructionReport({
      model,
      evidence: [evidence()],
      generatedAt: '2026-01-01T00:01:00.000Z',
      language: 'en-US',
    });

    expect(report.components[0]).toMatchObject({
      status: 'verified',
      evidenceIds: ['event'],
    });
    expect(report.repairedComponentIds).toEqual(['kc:stage:scene']);
    expect(JSON.stringify(report)).not.toMatch(/mastery|%/i);
  });

  it('does not invent conclusions for a component with no evidence', () => {
    const report = buildKnowledgeConstructionReport({ model, evidence: [], language: 'zh-CN' });
    expect(report.components[0]?.status).toBe('not_started');
    expect(report.components[0]?.explanation).toContain('尚未记录');
  });
});

describe('tutor learning context', () => {
  it('includes only the active component, recent evidence, and active repair summary', () => {
    const plan = {
      id: 'repair',
      stageId: 'stage',
      componentId: 'kc:stage:scene',
      triggerEvidenceIds: [],
      rationale: 'Needs another explanation',
      steps: [],
      status: 'active',
      contentVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as RepairPlan;
    const context = buildTutorLearningContext({
      stage,
      scenes: [scene],
      outlines: [],
      currentSceneId: 'scene',
      evidence: [evidence()],
      repairPlans: [plan],
    });

    expect(context).toMatchObject({
      currentComponent: { id: 'kc:stage:scene', sceneId: 'scene' },
      status: 'verified',
      activeRepairPlan: { id: 'repair' },
    });
    expect(context?.recentEvidence).toHaveLength(1);
  });
});

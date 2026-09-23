import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { getDocumentStore } from '@/lib/document-store/store';
import { validateAppScene } from '@/lib/document-store/validators';
import {
  applyAuthoredVerification,
  knowledgeContentInputSchema,
} from '@/lib/learning-loop/authoring';
import { buildKnowledgeModel } from '@/lib/learning-loop/knowledge-model';
import { foldComponentLearningState } from '@/lib/learning-loop/fold';
import { buildKnowledgeConstructionReport } from '@/lib/learning-loop/report';
import { buildTemplateRepairPlan } from '@/lib/learning-loop/repair-plan';
import type { AuthoredKnowledgeContent, LearningEvidence } from '@/lib/learning-loop/types';
import type { Scene, Stage } from '@/lib/types/stage';

const stage: Stage = { id: 'stage', name: 'Decimals', createdAt: 1, updatedAt: 1 };
const authored: AuthoredKnowledgeContent = {
  version: 1,
  revision: 'revision-1',
  updatedAt: '2026-09-23T00:00:00.000Z',
  objective: 'Compare decimal values',
  keyPoints: ['Compare place values'],
  verification: {
    question: 'Which is larger?',
    options: ['0.2', '0.3'],
    correctIndex: 1,
    explanation: 'Three tenths exceeds two tenths.',
  },
};
const scene: Scene = {
  id: 'scene',
  stageId: 'stage',
  type: 'quiz',
  title: 'Decimals',
  order: 1,
  content: { type: 'quiz', questions: [] },
  knowledgeContent: authored,
};

describe('authored knowledge content', () => {
  it('persists with the document and reconstructs the same component after reopening storage', async () => {
    const indexedDB = new IDBFactory();
    const deps = { indexedDB, dbName: 'authoring-test' };
    await getDocumentStore(deps).saveDocument({ stage, scenes: [scene] });
    const restored = await getDocumentStore(deps).loadDocument(stage.id);
    expect(restored?.scenes[0]?.knowledgeContent).toEqual(authored);
    const component = buildKnowledgeModel(restored!.stage, restored!.scenes, []).components[0]!;
    expect(component).toMatchObject({
      id: 'kc:stage:scene',
      objective: authored.objective,
      source: 'authored',
      contentRevision: authored.revision,
      authoredVerification: authored.verification,
    });
    expect(buildTemplateRepairPlan({ component, evidence: [] }).steps.at(-1)?.verification).toEqual(
      authored.verification,
    );
  });

  it('rejects invalid content at both the editor and document boundary, and safely derives legacy scenes', () => {
    for (const verification of [
      { ...authored.verification!, correctIndex: 7 },
      { ...authored.verification!, correctIndex: 0.5 },
      { ...authored.verification!, options: ['same', 'same'] },
      { ...authored.verification!, explanation: ' ' },
    ]) {
      expect(knowledgeContentInputSchema.safeParse({ ...authored, verification }).success).toBe(
        false,
      );
      expect(
        validateAppScene({ ...scene, knowledgeContent: { ...authored, verification } }).valid,
      ).toBe(false);
    }
    expect(knowledgeContentInputSchema.safeParse({ objective: ' ', keyPoints: [] }).success).toBe(
      false,
    );
    const legacy = buildKnowledgeModel(stage, [{ ...scene, knowledgeContent: undefined }], [])
      .components[0]!;
    expect(legacy.source).toBe('scene-derived');
    expect(legacy.contentRevision).toBeUndefined();
  });

  it('preserves history without crediting an old verification toward a revised component or report', () => {
    const component = buildKnowledgeModel(stage, [scene], []).components[0]!;
    const old: LearningEvidence = {
      eventId: 'old-pass',
      stageId: stage.id,
      componentId: component.id,
      learnerKey: 'learner',
      type: 'verification_passed',
      outcome: 'supports',
      strength: 'strong',
      source: 'repair',
      payload: {},
      occurredAt: '2026-09-22T00:00:00.000Z',
      schemaVersion: 1,
    };
    expect(foldComponentLearningState(component, [old])).toMatchObject({
      status: 'not_started',
      evidence: [],
      historicalEvidence: [old],
    });
    const report = buildKnowledgeConstructionReport({
      model: { stageId: stage.id, components: [component], version: 1 },
      evidence: [old],
    });
    expect(report.repairedComponentIds).toEqual([]);
    const fresh = {
      ...old,
      eventId: 'new-pass',
      payload: { componentRevision: authored.revision },
    };
    expect(foldComponentLearningState(component, [old, fresh]).status).toBe('verified');
  });

  it('keeps the manual answer even when an AI candidate changes it', () => {
    const component = buildKnowledgeModel(stage, [scene], []).components[0]!;
    const plan = buildTemplateRepairPlan({ component, evidence: [] });
    const candidate = {
      ...plan,
      steps: plan.steps.map((step) =>
        step.verification
          ? { ...step, verification: { ...step.verification, correctIndex: 0 } }
          : step,
      ),
    };
    expect(
      applyAuthoredVerification(candidate, component).steps.at(-1)?.verification?.correctIndex,
    ).toBe(1);
    expect(plan.componentRevision).toBe(authored.revision);
  });
});

import type { SceneOutline } from '@/lib/types/generation';
import type { Scene, Stage } from '@/lib/types/stage';

import { foldComponentLearningState } from './fold';
import { buildKnowledgeModel, componentForScene } from './knowledge-model';
import type { LearningEvidence, RepairPlan, TutorLearningContext } from './types';

export function buildTutorLearningContext(input: {
  stage: Stage | null;
  scenes: readonly Scene[];
  outlines: readonly SceneOutline[];
  currentSceneId: string | null;
  evidence: readonly LearningEvidence[];
  repairPlans: readonly RepairPlan[];
}): TutorLearningContext | undefined {
  if (!input.stage || !input.currentSceneId) return undefined;
  const model = buildKnowledgeModel(input.stage, input.scenes, input.outlines);
  const component = componentForScene(model, input.currentSceneId);
  if (!component) return undefined;
  const state = foldComponentLearningState(component, input.evidence);
  const activeRepairPlan = [...input.repairPlans]
    .reverse()
    .find(
      (plan) =>
        plan.componentId === component.id &&
        plan.componentRevision === component.contentRevision &&
        (plan.status === 'proposed' || plan.status === 'active'),
    );
  return {
    currentComponent: {
      id: component.id,
      title: component.title,
      ...(component.objective ? { objective: component.objective } : {}),
      sceneId: input.currentSceneId,
    },
    status: state.status,
    recentEvidence: state.evidence.slice(-6).map((item) => ({
      type: item.type,
      outcome: item.outcome,
      source: item.source,
      occurredAt: item.occurredAt,
    })),
    ...(activeRepairPlan
      ? {
          activeRepairPlan: {
            id: activeRepairPlan.id,
            rationale: activeRepairPlan.rationale,
            status: activeRepairPlan.status,
          },
        }
      : {}),
  };
}

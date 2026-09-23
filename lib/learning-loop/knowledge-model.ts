import type { SceneOutline } from '@/lib/types/generation';
import type { Scene, Stage } from '@/lib/types/stage';

import type { KnowledgeComponent, KnowledgeModel, LearningEvidenceType } from './types';
import { readAuthoredKnowledgeContent } from './authoring';

const VERIFICATION_EVIDENCE: LearningEvidenceType[] = [
  'verification_passed',
  'verification_failed',
];

export function knowledgeComponentId(stageId: string, sceneId: string): string {
  return `kc:${stageId}:${sceneId}`;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanKeyPoints(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const cleaned = cleanText(value);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function fallbackKeyPoints(scene: Scene): string[] {
  if (scene.type !== 'quiz') return [];
  return cleanKeyPoints(scene.content.questions.map((question) => question.question));
}

function outlineForScene(
  scene: Scene,
  outlinesById: ReadonlyMap<string, SceneOutline>,
): SceneOutline | undefined {
  if (!scene.outlineId) return undefined;
  return outlinesById.get(scene.outlineId);
}

/**
 * Derive the knowledge model, preferring validated app-owned scene annotations.
 *
 * Outline enrichment is identity-only. Scene order is mutable in Pro mode, so
 * using it as a fallback can attach another page's teaching objective after a
 * reorder. Legacy and inserted scenes instead remain valid scene-derived
 * components with conservative metadata.
 */
export function buildKnowledgeModel(
  stage: Stage | null | undefined,
  scenes: readonly Scene[],
  outlines: readonly SceneOutline[],
): KnowledgeModel {
  const modelStageId = stage?.id ?? scenes[0]?.stageId ?? '';
  const outlinesById = new Map<string, SceneOutline>();
  for (const outline of outlines) {
    if (!outlinesById.has(outline.id)) outlinesById.set(outline.id, outline);
  }

  const components: KnowledgeComponent[] = [];
  for (const scene of scenes) {
    const stageId = modelStageId || scene.stageId;
    const outline = outlineForScene(scene, outlinesById);
    const id = knowledgeComponentId(stageId, scene.id);
    const previous = components.at(-1);
    const authored = readAuthoredKnowledgeContent(scene.knowledgeContent);
    const title =
      cleanText(scene.title) ?? cleanText(outline?.title) ?? `Knowledge component ${scene.order}`;
    const objective =
      authored?.objective ??
      cleanText(outline?.teachingObjective) ??
      cleanText(outline?.description);
    const keyPoints =
      authored?.keyPoints ??
      (outline ? cleanKeyPoints(outline.keyPoints) : fallbackKeyPoints(scene));
    const acceptedEvidenceTypes =
      scene.type === 'quiz'
        ? (['quiz_reviewed', ...VERIFICATION_EVIDENCE] satisfies LearningEvidenceType[])
        : [...VERIFICATION_EVIDENCE];

    components.push({
      id,
      stageId,
      title,
      ...(objective ? { objective } : {}),
      keyPoints,
      ...(authored
        ? { contentRevision: authored.revision, authoredVerification: authored.verification }
        : {}),
      sceneIds: [scene.id],
      prerequisiteIds: previous ? [previous.id] : [],
      verification: {
        requiredEvidenceCount: 1,
        acceptedEvidenceTypes,
      },
      source: authored ? 'authored' : outline ? 'outline-derived' : 'scene-derived',
      version: 1,
    });
  }

  return { stageId: modelStageId, components, version: 1 };
}

export function componentForScene(
  model: KnowledgeModel,
  sceneId: string,
): KnowledgeComponent | undefined {
  return model.components.find((component) => component.sceneIds.includes(sceneId));
}

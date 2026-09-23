import { useStageStore } from '@/lib/store/stage';
import { isLearningLoopEnabled } from '@/lib/config/feature-flags';
import {
  knowledgeContentInputSchema,
  readAuthoredKnowledgeContent,
  type KnowledgeContentInput,
} from './authoring';
import type { AuthoredKnowledgeContent } from './types';

export async function saveKnowledgeContent(
  stageId: string,
  sceneId: string,
  input: KnowledgeContentInput,
): Promise<void> {
  const state = useStageStore.getState();
  if (
    !isLearningLoopEnabled() ||
    !state.isOwner ||
    state.readOnly ||
    state.stage?.id !== stageId ||
    state.generatingOutlines.length > 0
  ) {
    throw new Error('Course is not editable');
  }
  const scene = state.scenes.find((scene) => scene.id === sceneId && scene.stageId === stageId);
  if (!scene) {
    throw new Error('Scene is no longer available');
  }
  const parsed = knowledgeContentInputSchema.parse(input);
  const previous = readAuthoredKnowledgeContent(scene.knowledgeContent);
  // Retrying a failed save, or saving an unchanged form, must not invalidate
  // the current evidence and active repair plan with another content revision.
  if (
    !previous ||
    JSON.stringify(knowledgeContentInputSchema.parse(previous)) !== JSON.stringify(parsed)
  ) {
    const content: AuthoredKnowledgeContent = {
      ...parsed,
      version: 1,
      revision: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    state.updateScene(sceneId, { knowledgeContent: content });
  }
  if (!(await useStageStore.getState().saveToStorage())) {
    throw new Error('Course save was not confirmed; retry before leaving');
  }
}

import { foldComponentLearningState } from '@/lib/learning-loop/fold';
import type { KnowledgeModel, LearningEvidence } from '@/lib/learning-loop/types';
import type { KnowledgeCard } from '@/lib/knowledge-cards/types';
import type { LearningTask } from './types';

export type ReviewGroup = 'pending' | 'not_started' | 'building' | 'verified';

export function buildReviewWorkbench(
  model: KnowledgeModel,
  evidence: LearningEvidence[],
  tasks: LearningTask[],
  cards: KnowledgeCard[],
) {
  const courseTasks = tasks.filter((task) => task.classroomId === model.stageId);
  return model.components
    .map((component, order) => {
      const state = foldComponentLearningState(
        component,
        evidence.filter((event) => event.stageId === model.stageId),
      );
      const markedTasks = courseTasks.filter((task) =>
        task.reviewSceneIds.some((id) => component.sceneIds.includes(id)),
      );
      const notes = courseTasks.flatMap((task) =>
        Object.values(task.notes)
          .filter((note) => component.sceneIds.includes(note.sceneId) && note.content.trim())
          .map((note) => ({ taskId: task.id, title: task.knowledgePoint, ...note })),
      );
      const relatedCards = cards.filter(
        (card) =>
          card.source.stageId === model.stageId &&
          (card.source.componentId
            ? card.source.componentId === component.id
            : component.sceneIds.includes(card.source.sceneId ?? '')),
      );
      const group: ReviewGroup =
        state.status === 'needs_revisit' || markedTasks.length
          ? 'pending'
          : state.status === 'not_started'
            ? 'not_started'
            : state.status === 'verified'
              ? 'verified'
              : 'building';
      return { component, state, markedTasks, notes, cards: relatedCards, group, order };
    })
    .sort(
      (a, b) =>
        Number(b.state.status === 'needs_revisit') - Number(a.state.status === 'needs_revisit') ||
        a.order - b.order,
    );
}
export type ReviewWorkbenchItem = ReturnType<typeof buildReviewWorkbench>[number];

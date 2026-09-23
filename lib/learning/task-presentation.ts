import type { LearningTask } from './types';

/** Recognizes the deterministic backfill identity, including records created before this UI change. */
export function isAutomaticLearningRecord(task: LearningTask): boolean {
  return !!task.classroomId && task.id === `classroom:${encodeURIComponent(task.classroomId)}`;
}

export function learningRecordHref(task: LearningTask): string {
  return isAutomaticLearningRecord(task)
    ? `/classroom/${encodeURIComponent(task.classroomId!)}`
    : `/learn/${encodeURIComponent(task.id)}`;
}

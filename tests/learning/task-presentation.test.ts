import { describe, expect, it } from 'vitest';
import { isAutomaticLearningRecord, learningRecordHref } from '@/lib/learning/task-presentation';
import { createConceptLearningTask } from '@/lib/learning/task-template';

describe('optional learning records', () => {
  const task = {
    ...createConceptLearningTask(
      { courseName: '数学', knowledgePoint: '小数', learningGoal: '自己的目标' },
      { id: 'manual' },
    ),
    classroomId: 'course/1',
  };
  it('keeps explicitly created learning tasks and their detail navigation', () => {
    expect(isAutomaticLearningRecord(task)).toBe(false);
    expect(learningRecordHref(task)).toBe('/learn/manual');
  });
  it('recognizes existing automatic records without migration and opens the course directly', () => {
    const auto = { ...task, id: 'classroom:course%2F1' };
    expect(isAutomaticLearningRecord(auto)).toBe(true);
    expect(learningRecordHref(auto)).toBe('/classroom/course%2F1');
    expect(auto.learningGoal).toBe('自己的目标');
  });
  it('does not infer automatic creation from the prefix alone', () => {
    expect(isAutomaticLearningRecord({ ...task, id: 'classroom:other' })).toBe(false);
    expect(isAutomaticLearningRecord({ ...task, classroomId: undefined })).toBe(false);
  });
});

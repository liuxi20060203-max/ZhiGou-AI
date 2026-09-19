import { describe, expect, it } from 'vitest';

import { buildKnowledgeModel, componentForScene } from '@/lib/learning-loop/knowledge-model';
import type { SceneOutline } from '@/lib/types/generation';
import type { Scene, Stage } from '@/lib/types/stage';

const stage: Stage = {
  id: 'stage-1',
  name: 'Course',
  createdAt: 1,
  updatedAt: 1,
};

function slide(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    stageId: stage.id,
    type: 'slide',
    title: 'Current scene title',
    order: 1,
    content: { type: 'slide', canvas: {} },
    ...overrides,
  } as Scene;
}

function outline(overrides: Partial<SceneOutline> = {}): SceneOutline {
  return {
    id: 'outline-1',
    type: 'slide',
    title: 'Original outline title',
    description: 'Understand the central idea.',
    teachingObjective: 'Explain the central idea.',
    keyPoints: ['First point', 'Second point'],
    order: 1,
    ...overrides,
  };
}

describe('buildKnowledgeModel', () => {
  it('builds one stable component for every scene and a linear prerequisite path', () => {
    const scenes = [
      slide({ id: 'scene-a', order: 1, outlineId: 'outline-a' }),
      slide({ id: 'scene-b', order: 2, title: 'Second', outlineId: 'outline-b' }),
    ];
    const model = buildKnowledgeModel(stage, scenes, [
      outline({ id: 'outline-a', order: 1 }),
      outline({ id: 'outline-b', order: 2 }),
    ]);

    expect(model.components.map((component) => component.id)).toEqual([
      'kc:stage-1:scene-a',
      'kc:stage-1:scene-b',
    ]);
    expect(model.components[0]?.prerequisiteIds).toEqual([]);
    expect(model.components[1]?.prerequisiteIds).toEqual(['kc:stage-1:scene-a']);
    expect(componentForScene(model, 'scene-b')?.title).toBe('Second');
  });

  it('uses outline identity for enrichment while keeping the current scene title', () => {
    const scene = slide({ outlineId: 'outline-2', order: 1, title: 'Edited title' });
    const model = buildKnowledgeModel(
      stage,
      [scene],
      [
        outline({ id: 'outline-1', order: 1, teachingObjective: 'Wrong objective' }),
        outline({
          id: 'outline-2',
          order: 2,
          teachingObjective: 'Stable objective',
          keyPoints: ['Stable point'],
        }),
      ],
    );

    expect(model.components[0]).toMatchObject({
      title: 'Edited title',
      objective: 'Stable objective',
      keyPoints: ['Stable point'],
      source: 'outline-derived',
    });
  });

  it('never attaches an outline by mutable order to a legacy or inserted scene', () => {
    const model = buildKnowledgeModel(
      stage,
      [slide({ id: 'inserted', outlineId: undefined, order: 1, title: 'Inserted page' })],
      [outline({ id: 'another-page', order: 1, teachingObjective: 'Must not leak' })],
    );

    expect(model.components[0]).toMatchObject({
      id: 'kc:stage-1:inserted',
      title: 'Inserted page',
      keyPoints: [],
      source: 'scene-derived',
    });
    expect(model.components[0]).not.toHaveProperty('objective');
  });

  it('derives conservative quiz key points and accepts quiz review as evidence', () => {
    const quiz = {
      id: 'quiz-1',
      stageId: stage.id,
      type: 'quiz',
      title: 'Quick check',
      order: 1,
      content: {
        type: 'quiz',
        questions: [
          { id: 'q1', type: 'single', question: 'What is A?' },
          { id: 'q2', type: 'short_answer', question: '  Explain B.  ' },
        ],
      },
    } as Scene;

    const component = buildKnowledgeModel(stage, [quiz], []).components[0];

    expect(component?.keyPoints).toEqual(['What is A?', 'Explain B.']);
    expect(component?.verification.acceptedEvidenceTypes).toContain('quiz_reviewed');
  });

  it('supports an empty legacy load without inventing a stage or components', () => {
    expect(buildKnowledgeModel(null, [], [])).toEqual({
      stageId: '',
      components: [],
      version: 1,
    });
  });
});

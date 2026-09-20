import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import { trackLearningLoopEvent } from '@/lib/learning-loop/analytics';
import { buildTemplateRepairPlan } from '@/lib/learning-loop/repair-plan';
import { buildRepairPlanPrompts } from '@/lib/learning-loop/repair-prompts';
import type { KnowledgeComponent } from '@/lib/learning-loop/types';

const component: KnowledgeComponent = {
  id: 'kc:stage:scene',
  stageId: 'stage',
  title: 'Closures',
  objective: 'Explain captured variables',
  keyPoints: ['Lexical scope', 'Captured variables remain available'],
  sceneIds: ['scene'],
  prerequisiteIds: [],
  verification: { requiredEvidenceCount: 1, acceptedEvidenceTypes: ['verification_passed'] },
  source: 'authored',
  version: 1,
};

describe('learning-loop observability and eval assets', () => {
  it('keeps analytics safe in non-browser runtimes', () => {
    expect(() =>
      trackLearningLoopEvent({
        name: 'learning_loop_component_viewed',
        stageId: 'stage',
        componentId: component.id,
      }),
    ).not.toThrow();
  });

  it('ships the planned 20-scenario bilingual evaluation set', () => {
    const cases = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'eval/learning-loop-repair/scenarios/cases.json'),
        'utf8',
      ),
    ) as Array<{ language: string }>;
    expect(cases).toHaveLength(20);
    expect(cases.some((item) => item.language === 'zh-CN')).toBe(true);
    expect(cases.some((item) => item.language === 'en-US')).toBe(true);
  });

  it('uses the same bounded generation prompt for production and eval', () => {
    const fallbackPlan = buildTemplateRepairPlan({ component, evidence: [] });
    const prompts = buildRepairPlanPrompts({
      component,
      fallbackPlan,
      evidenceSummary: [{ type: 'quiz_reviewed', outcome: 'contradicts' }],
      language: 'en-US',
    });
    expect(prompts.system).toContain('1 to 3 steps');
    expect(prompts.system).toContain('exactly one verification step');
    expect(prompts.prompt).toContain('quiz_reviewed');
  });
});

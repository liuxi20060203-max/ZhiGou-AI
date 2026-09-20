import type { KnowledgeComponent, RepairPlan } from './types';

export function buildRepairPlanPrompts(input: {
  component: KnowledgeComponent;
  fallbackPlan: RepairPlan;
  evidenceSummary: Array<{ type: string; outcome: string }>;
  language?: string;
}): { system: string; prompt: string } {
  const chinese = input.language === 'zh-CN';
  return {
    system: chinese
      ? `你是知构课堂的补学设计器。只输出 JSON，不要输出 Markdown。生成 1 至 3 个步骤，必须包含且仅包含一个 verification 步骤。步骤 type 只能是 explanation、example、verification。verification 必须包含 question、2 至 4 个 options、correctIndex 和 explanation。内容必须基于输入知识构件，不得声称掌握度或修改原课程。`
      : `You design short evidence-based repair paths. Return JSON only, never Markdown. Generate 1 to 3 steps with exactly one verification step. Step type must be explanation, example, or verification. Verification requires question, 2 to 4 options, correctIndex, and explanation. Stay grounded in the supplied component, do not claim mastery, and do not modify the course.`,
    prompt: JSON.stringify({
      outputShape: { rationale: 'string', steps: input.fallbackPlan.steps },
      component: {
        id: input.component.id,
        title: input.component.title,
        objective: input.component.objective,
        keyPoints: input.component.keyPoints.slice(0, 6),
      },
      evidence: input.evidenceSummary.slice(-8),
    }),
  };
}

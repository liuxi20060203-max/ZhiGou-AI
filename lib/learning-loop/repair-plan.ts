import type { KnowledgeComponent, LearningEvidence, RepairPlan, RepairStep } from './types';

function distractors(component: KnowledgeComponent, answer: string): string[] {
  const candidates = [
    ...component.keyPoints.filter((point) => point !== answer),
    `与“${component.title}”无直接关系的描述`,
    `只记住术语，不说明“${component.title}”的含义`,
  ];
  return candidates.slice(0, 2);
}

export function buildTemplateRepairPlan(input: {
  component: KnowledgeComponent;
  evidence: readonly LearningEvidence[];
  now?: string;
  id?: string;
}): RepairPlan {
  const { component } = input;
  const now = input.now ?? new Date().toISOString();
  const answer = component.keyPoints[0] ?? component.objective ?? component.title;
  const options = [answer, ...distractors(component, answer)];
  const keyPointSummary = component.keyPoints.length
    ? component.keyPoints.slice(0, 3).join('；')
    : (component.objective ?? component.title);
  const steps: RepairStep[] = [
    {
      id: 'explanation',
      type: 'explanation',
      title: '换一种方式理解',
      content: `先抓住“${component.title}”要解决的核心问题：${component.objective ?? keyPointSummary}。不要急着记结论，先说明它处理的对象、条件和结果。`,
    },
    {
      id: 'example',
      type: 'example',
      title: '用关键点做对照',
      content: `把下面内容与原讲解逐项对应：${keyPointSummary}。能够说清每一点“为什么成立”，比只复述术语更重要。`,
    },
    {
      id: 'verification',
      type: 'verification',
      title: '快速验证',
      content: '选择最符合当前知识构件目标的一项。',
      verification: {
        question: `关于“${component.title}”，哪一项最符合本节的关键内容？`,
        options,
        correctIndex: 0,
        explanation: `本构件的关键依据是：${answer}`,
      },
    },
  ];
  return {
    id: input.id ?? `repair:${component.id}:${Date.parse(now)}`,
    stageId: component.stageId,
    componentId: component.id,
    triggerEvidenceIds: input.evidence
      .filter((item) => item.outcome === 'contradicts')
      .map((item) => item.eventId),
    rationale: input.evidence.some(
      (item) => item.type === 'quiz_reviewed' && item.outcome === 'contradicts',
    )
      ? '理解检测中出现了需要回看的回答，建议换一种解释后再验证。'
      : '你标记了当前内容尚未理解，建议通过解释、对照和快速验证重新构建。',
    steps,
    status: 'proposed',
    contentVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function isValidRepairPlan(plan: RepairPlan): boolean {
  if (plan.contentVersion !== 1 || plan.steps.length < 1 || plan.steps.length > 3) return false;
  if (!plan.steps.some((step) => step.type === 'verification' && step.verification)) return false;
  return plan.steps.every((step) => {
    if (!step.id || !step.title || !step.content) return false;
    if (!['explanation', 'example', 'verification'].includes(step.type)) return false;
    if (step.type !== 'verification') return step.verification === undefined;
    const check = step.verification;
    return Boolean(
      check &&
      check.question &&
      check.options.length >= 2 &&
      check.correctIndex >= 0 &&
      check.correctIndex < check.options.length &&
      check.explanation,
    );
  });
}

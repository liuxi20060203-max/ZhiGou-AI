import { foldComponentLearningState } from './fold';
import type {
  KnowledgeConstructionReport,
  KnowledgeModel,
  LearningComponentStatus,
  LearningEvidence,
} from './types';

function explanation(status: LearningComponentStatus, count: number, chinese: boolean): string {
  if (status === 'not_started')
    return chinese
      ? '尚未记录与此构件相关的学习证据。'
      : 'No learning evidence has been recorded for this component.';
  if (status === 'in_progress')
    return chinese
      ? '已进入或完成学习步骤，但尚未产生可验证的理解证据。'
      : 'The component was visited, but no verifiable understanding evidence exists yet.';
  if (status === 'needs_revisit')
    return chinese
      ? `已有 ${count} 条证据，其中包含尚未解决的反证。`
      : `${count} evidence items include an unresolved contradiction.`;
  if (status === 'verified')
    return chinese
      ? `已有 ${count} 条证据，最近的有效验证支持当前理解。`
      : `${count} evidence items include a recent valid verification.`;
  return chinese
    ? `已有 ${count} 条学习证据，但暂不足以形成验证结论。`
    : `${count} evidence items are available, but they do not yet support a verification.`;
}

export function buildKnowledgeConstructionReport(input: {
  model: KnowledgeModel;
  evidence: readonly LearningEvidence[];
  generatedAt?: string;
  language?: string;
}): KnowledgeConstructionReport {
  const chinese = input.language === 'zh-CN';
  const components = input.model.components.map((component) => {
    const state = foldComponentLearningState(component, input.evidence);
    return {
      componentId: component.id,
      title: component.title,
      status: state.status,
      evidenceIds: state.evidence.map((item) => item.eventId),
      explanation:
        (state.historicalEvidence?.length
          ? chinese
            ? '内容已更新；旧版记录作为历史保留。'
            : 'Content has changed; older evidence is retained as history. '
          : '') + explanation(state.status, state.evidence.length, chinese),
      ...(state.status === 'needs_revisit'
        ? {
            suggestedNextAction: chinese
              ? '继续或重新启动该构件的补学路径。'
              : 'Continue or restart the repair path for this component.',
          }
        : state.status === 'not_started'
          ? {
              suggestedNextAction: chinese
                ? '返回知识路径学习该构件。'
                : 'Return to the knowledge path and study this component.',
            }
          : {}),
    };
  });
  const repairedComponentIds = components
    .filter((component) =>
      input.evidence.some(
        (item) =>
          component.evidenceIds.includes(item.eventId) && item.type === 'verification_passed',
      ),
    )
    .map((component) => component.componentId);
  return {
    stageId: input.model.stageId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    components,
    repairedComponentIds,
    unresolvedComponentIds: components
      .filter((component) => component.status === 'needs_revisit')
      .map((component) => component.componentId),
  };
}

import type { NextRequest } from 'next/server';

import { callLLM } from '@/lib/ai/llm';
import { isLearningLoopAiEnabled } from '@/lib/config/feature-flags';
import { createLogger } from '@/lib/logger';
import { isValidRepairPlan } from '@/lib/learning-loop/repair-plan';
import type { KnowledgeComponent, RepairPlan, RepairStep } from '@/lib/learning-loop/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

const log = createLogger('Learning Loop Repair Plan');

interface RepairPlanRequest {
  component: KnowledgeComponent;
  plan: RepairPlan;
  evidenceSummary: Array<{ type: string; outcome: string }>;
  language?: string;
}

function parseSteps(value: unknown): RepairStep[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return undefined;
  return value as RepairStep[];
}

export async function POST(req: NextRequest) {
  if (!isLearningLoopAiEnabled()) {
    return apiError('INVALID_REQUEST', 404, 'AI repair plan generation is disabled');
  }
  let body: RepairPlanRequest;
  try {
    body = (await req.json()) as RepairPlanRequest;
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Request body must be valid JSON');
  }
  if (!body.component?.id || !body.plan || body.plan.componentId !== body.component.id) {
    return apiError('INVALID_REQUEST', 400, 'component and matching plan are required');
  }
  if (!Array.isArray(body.plan.steps) || !isValidRepairPlan(body.plan)) {
    return apiError('INVALID_REQUEST', 400, 'fallback plan is invalid');
  }

  try {
    const { model, thinkingConfig } = await resolveModelFromRequest(
      req,
      body,
      'learning-loop-repair',
    );
    const chinese = body.language === 'zh-CN';
    const result = await callLLM(
      {
        model,
        system: chinese
          ? `你是知构课堂的补学设计器。只输出 JSON，不要输出 Markdown。生成 1 至 3 个步骤，必须包含且仅包含一个 verification 步骤。步骤 type 只能是 explanation、example、verification。verification 必须包含 question、2 至 4 个 options、correctIndex 和 explanation。内容必须基于输入知识构件，不得声称掌握度或修改原课程。`
          : `You design short evidence-based repair paths. Return JSON only, never Markdown. Generate 1 to 3 steps with exactly one verification step. Step type must be explanation, example, or verification. Verification requires question, 2 to 4 options, correctIndex, and explanation. Stay grounded in the supplied component, do not claim mastery, and do not modify the course.`,
        prompt: JSON.stringify({
          outputShape: { rationale: 'string', steps: body.plan.steps },
          component: {
            id: body.component.id,
            title: body.component.title,
            objective: body.component.objective,
            keyPoints: body.component.keyPoints.slice(0, 6),
          },
          evidence: body.evidenceSummary.slice(-8),
        }),
      },
      'learning-loop-repair',
      undefined,
      thinkingConfig,
    );
    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return apiError('PARSE_FAILED', 502, 'Repair plan response contained no JSON');
    const parsed = JSON.parse(json) as { rationale?: unknown; steps?: unknown };
    const steps = parseSteps(parsed.steps);
    if (typeof parsed.rationale !== 'string' || !steps) {
      return apiError('PARSE_FAILED', 502, 'Repair plan response has an invalid shape');
    }
    const plan: RepairPlan = {
      ...body.plan,
      rationale: parsed.rationale.trim(),
      steps,
      updatedAt: new Date().toISOString(),
    };
    if (!plan.rationale || !isValidRepairPlan(plan)) {
      return apiError('PARSE_FAILED', 502, 'Repair plan failed validation');
    }
    return apiSuccess({ plan });
  } catch (error) {
    log.error('Repair plan generation failed:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to generate repair plan');
  }
}

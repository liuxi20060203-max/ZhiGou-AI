import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { callLLM } from '@/lib/ai/llm';
import { buildTemplateRepairPlan, isValidRepairPlan } from '@/lib/learning-loop/repair-plan';
import { buildRepairPlanPrompts } from '@/lib/learning-loop/repair-prompts';
import type { KnowledgeComponent, RepairPlan } from '@/lib/learning-loop/types';
import { createRunDir } from '../shared/run-dir';
import { resolveEvalModel } from '../shared/resolve-model';

interface Scenario {
  id: string;
  language: string;
  title: string;
  objective: string;
  keyPoints: string[];
  evidence: Array<{ type: string; outcome: string }>;
}

interface RubricScore {
  evidenceGrounding: number;
  conceptualAccuracy: number;
  difficultyFit: number;
  structuralCompliance: number;
  explainability: number;
  reason: string;
}

function currentDir(): string {
  return typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
}

function parseJsonObject(text: string): Record<string, unknown> {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('response contained no JSON object');
  return JSON.parse(json) as Record<string, unknown>;
}

async function main() {
  const generatorName = process.env.EVAL_REPAIR_MODEL ?? process.env.DEFAULT_MODEL;
  const judgeName = process.env.EVAL_JUDGE_MODEL;
  if (!generatorName || !judgeName) {
    throw new Error('Set EVAL_REPAIR_MODEL (or DEFAULT_MODEL) and EVAL_JUDGE_MODEL.');
  }
  const { model: generator } = await resolveEvalModel('EVAL_REPAIR_MODEL', generatorName);
  const { model: judge } = await resolveEvalModel('EVAL_JUDGE_MODEL');
  const scenarios = JSON.parse(
    readFileSync(join(currentDir(), 'scenarios/cases.json'), 'utf8'),
  ) as Scenario[];
  const results = [];
  for (const scenario of scenarios) {
    const component: KnowledgeComponent = {
      id: `kc:eval:${scenario.id}`,
      stageId: 'eval',
      title: scenario.title,
      objective: scenario.objective,
      keyPoints: scenario.keyPoints,
      sceneIds: [scenario.id],
      prerequisiteIds: [],
      verification: { requiredEvidenceCount: 1, acceptedEvidenceTypes: ['verification_passed'] },
      source: 'authored',
      version: 1,
    };
    const fallback = buildTemplateRepairPlan({
      component,
      evidence: [],
      id: `repair:${scenario.id}`,
    });
    const prompts = buildRepairPlanPrompts({
      component,
      fallbackPlan: fallback,
      evidenceSummary: scenario.evidence,
      language: scenario.language,
    });
    try {
      const generated = await callLLM(
        { model: generator, system: prompts.system, prompt: prompts.prompt },
        'eval-learning-loop-repair',
      );
      const parsed = parseJsonObject(generated.text);
      const candidate = {
        ...fallback,
        rationale: parsed.rationale,
        steps: parsed.steps,
      } as RepairPlan;
      const structural = isValidRepairPlan(candidate);
      const judged = await callLLM(
        {
          model: judge,
          system:
            'Score the repair plan on five dimensions from 0 to 2. Return JSON only with evidenceGrounding, conceptualAccuracy, difficultyFit, structuralCompliance, explainability, and reason. A factual error requires conceptualAccuracy=0.',
          prompt: JSON.stringify({ scenario, candidate }),
        },
        'eval-learning-loop-repair-judge',
      );
      const score = parseJsonObject(judged.text) as unknown as RubricScore;
      const total =
        score.evidenceGrounding +
        score.conceptualAccuracy +
        score.difficultyFit +
        score.structuralCompliance +
        score.explainability;
      results.push({
        id: scenario.id,
        structural,
        score,
        total,
        passed: structural && score.conceptualAccuracy > 0 && total >= 8,
        candidate,
      });
    } catch (error) {
      results.push({
        id: scenario.id,
        structural: false,
        total: 0,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const runDir = createRunDir('eval/learning-loop-repair/results', generatorName);
  const output = join(runDir, 'report.json');
  writeFileSync(output, `${JSON.stringify({ generatorName, judgeName, results }, null, 2)}\n`);
  const passed = results.filter((result) => result.passed).length;
  console.log(`Learning-loop repair eval: ${passed}/${results.length} passed. Report: ${output}`);
  if (passed !== results.length) process.exitCode = 1;
}

void main();

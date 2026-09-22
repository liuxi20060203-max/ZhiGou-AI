'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { trackLearningLoopEvent } from '@/lib/learning-loop/analytics';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { buildTemplateRepairPlan, isValidRepairPlan } from '@/lib/learning-loop/repair-plan';
import {
  appendLearningEvidence,
  appendRepairPlanSnapshot,
  notifyLearningJourneyChanged,
  readRepairPlans,
} from '@/lib/learning-loop/runtime';
import type {
  KnowledgeComponent,
  LearningEvidence,
  LearningEvidencePayload,
  RepairPlan,
} from '@/lib/learning-loop/types';
import { cn } from '@/lib/utils';

interface RepairPanelProps {
  readonly component: KnowledgeComponent;
  readonly evidence: LearningEvidence[];
  readonly isChinese: boolean;
  readonly onClose: () => void;
}

function evidenceEvent(input: {
  eventId: string;
  component: KnowledgeComponent;
  type: LearningEvidencePayload['type'];
  outcome: LearningEvidencePayload['outcome'];
  strength: LearningEvidencePayload['strength'];
  payload: Record<string, unknown>;
}): LearningEvidencePayload {
  return {
    eventId: input.eventId,
    componentId: input.component.id,
    sceneId: input.component.sceneIds[0],
    type: input.type,
    outcome: input.outcome,
    strength: input.strength,
    source: 'repair',
    payload: input.payload,
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}

export function RepairPanel({ component, evidence, isChinese, onClose }: RepairPanelProps) {
  // Evidence changes after every repair step. Capture the opening context so those
  // updates cannot re-run preparation and overwrite an in-flight completion.
  const [openingContext] = useState(() => ({ component, evidence, isChinese }));
  const [plan, setPlan] = useState<RepairPlan>();
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number>();
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const { component, evidence, isChinese } = openingContext;
    let cancelled = false;
    async function prepare() {
      try {
        const existing = (await readRepairPlans(component.stageId))
          .filter(
            (item) =>
              item.componentId === component.id &&
              (item.status === 'proposed' || item.status === 'active'),
          )
          .at(-1);
        if (existing) {
          if (!cancelled) setPlan(existing);
          return;
        }

        const fallback = buildTemplateRepairPlan({ component, evidence });
        await appendRepairPlanSnapshot(fallback);
        let resolved = fallback;
        try {
          const modelConfig = getCurrentModelConfig();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-model': modelConfig.modelString,
            'x-api-key': modelConfig.apiKey,
          };
          if (modelConfig.baseUrl) headers['x-base-url'] = modelConfig.baseUrl;
          if (modelConfig.providerType) headers['x-provider-type'] = modelConfig.providerType;
          const response = await fetch('/api/learning-loop/repair-plan', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              component,
              plan: fallback,
              evidenceSummary: evidence.map((item) => ({
                type: item.type,
                outcome: item.outcome,
              })),
              language: isChinese ? 'zh-CN' : 'en-US',
            }),
          });
          if (response.ok) {
            const body = (await response.json()) as { plan?: RepairPlan };
            if (body.plan && isValidRepairPlan(body.plan)) resolved = body.plan;
          } else {
            trackLearningLoopEvent({
              name: 'learning_loop_generation_failed',
              stageId: component.stageId,
              componentId: component.id,
              outcome: response.status === 404 ? 'disabled' : `http_${response.status}`,
            });
          }
        } catch {
          // The deterministic fallback is a complete product path, not an error state.
          trackLearningLoopEvent({
            name: 'learning_loop_generation_failed',
            stageId: component.stageId,
            componentId: component.id,
            outcome: 'network_error',
          });
        }
        const active = {
          ...resolved,
          status: 'active' as const,
          updatedAt: new Date().toISOString(),
        };
        await appendRepairPlanSnapshot(active);
        trackLearningLoopEvent({
          name: 'learning_loop_repair_started',
          stageId: component.stageId,
          componentId: component.id,
        });
        if (!cancelled) setPlan(active);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void prepare();
    return () => {
      cancelled = true;
    };
  }, [openingContext]);

  const step = plan?.steps[stepIndex];
  const progress = useMemo(
    () => (plan ? `${Math.min(stepIndex + 1, plan.steps.length)}/${plan.steps.length}` : ''),
    [plan, stepIndex],
  );

  async function completeContentStep() {
    if (!plan || !step || step.type === 'verification') return;
    try {
      await appendLearningEvidence(
        component.stageId,
        evidenceEvent({
          eventId: `repair-step:${plan.id}:${step.id}`,
          component,
          type: 'repair_step_completed',
          outcome: 'neutral',
          strength: 'weak',
          payload: { planId: plan.id, stepId: step.id },
        }),
      );
      trackLearningLoopEvent({
        name: 'learning_loop_repair_step_completed',
        stageId: component.stageId,
        componentId: component.id,
      });
      setStepIndex((current) => Math.min(current + 1, plan.steps.length - 1));
      notifyLearningJourneyChanged(component.stageId);
    } catch {
      setError(true);
    }
  }

  async function submitVerification() {
    if (!plan || !step?.verification || selectedOption === undefined) return;
    const passed = selectedOption === step.verification.correctIndex;
    try {
      await appendLearningEvidence(
        component.stageId,
        evidenceEvent({
          eventId: passed
            ? `verification:${plan.id}:${step.id}:passed`
            : `verification:${plan.id}:${step.id}:failed:${Date.now()}`,
          component,
          type: passed ? 'verification_passed' : 'verification_failed',
          outcome: passed ? 'supports' : 'contradicts',
          strength: 'strong',
          payload: { planId: plan.id, stepId: step.id, selectedOption },
        }),
      );
      if (passed) {
        const completed: RepairPlan = {
          ...plan,
          status: 'completed',
          updatedAt: new Date().toISOString(),
        };
        await appendRepairPlanSnapshot(completed);
        setPlan(completed);
      } else {
        setVerificationFailed(true);
      }
      notifyLearningJourneyChanged(component.stageId);
      trackLearningLoopEvent({
        name: 'learning_loop_verification_completed',
        stageId: component.stageId,
        componentId: component.id,
        outcome: passed ? 'passed' : 'failed',
      });
    } catch {
      setError(true);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        data-testid="repair-panel"
        className="flex h-[min(680px,calc(100dvh-32px))] w-[min(460px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border border-primary/20 bg-background p-0 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-border/70 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              {isChinese ? '自适应补学' : 'Adaptive repair'}
            </p>
            <DialogTitle className="mt-1 text-sm font-semibold">{component.title}</DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            aria-label={isChinese ? '稍后继续' : 'Continue later'}
          >
            <X className="size-4" />
          </button>
        </header>

        {!plan && !error && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {isChinese ? '正在组织补学路径…' : 'Preparing your repair path…'}
          </div>
        )}
        {error && !plan && (
          <div className="m-5 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            {isChinese
              ? '补学路径暂时无法保存，请稍后重试。'
              : 'The repair path could not be saved.'}
          </div>
        )}
        {plan && step && (
          <>
            <div className="border-b border-border/60 px-5 py-3">
              <p className="text-xs leading-5 text-muted-foreground">{plan.rationale}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((stepIndex + 1) / plan.steps.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {plan.status === 'completed' ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <Check className="size-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">
                    {isChinese ? '本轮补学已完成' : 'Repair path completed'}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {isChinese
                      ? '新的验证证据已经写入知识路径。'
                      : 'New verification evidence is now reflected in the knowledge path.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                      {progress}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {step.type === 'explanation'
                        ? isChinese
                          ? '换种解释'
                          : 'Alternative explanation'
                        : step.type === 'example'
                          ? isChinese
                            ? '对比例子'
                            : 'Contrast example'
                          : isChinese
                            ? '微型验证'
                            : 'Quick check'}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/85">{step.content}</p>
                  {step.verification && (
                    <div className="mt-5">
                      <p className="text-sm font-medium leading-6">{step.verification.question}</p>
                      <div className="mt-3 space-y-2">
                        {step.verification.options.map((option, index) => (
                          <button
                            key={`${index}-${option}`}
                            type="button"
                            onClick={() => {
                              setSelectedOption(index);
                              setVerificationFailed(false);
                            }}
                            className={cn(
                              'w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-colors',
                              selectedOption === index
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border hover:border-primary/30 hover:bg-muted/50',
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {verificationFailed && (
                        <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                          {step.verification.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <footer className="border-t border-border/70 p-4">
              {plan.status === 'completed' ? (
                <Button className="w-full" onClick={onClose}>
                  {isChinese ? '返回课堂' : 'Return to class'}
                </Button>
              ) : step.type === 'verification' ? (
                <Button
                  className="w-full"
                  disabled={selectedOption === undefined}
                  onClick={() => void submitVerification()}
                >
                  {isChinese ? '提交验证' : 'Submit check'}
                </Button>
              ) : (
                <Button className="w-full" onClick={() => void completeContentStep()}>
                  {isChinese ? '理解了，继续' : 'Got it, continue'}
                </Button>
              )}
              {error && (
                <p className="mt-2 text-center text-[10px] text-destructive">
                  {isChinese ? '保存失败，请重试当前操作。' : 'Save failed. Please retry.'}
                </p>
              )}
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ComponentLearningState } from '@/lib/learning-loop/fold';
import type { KnowledgeComponent, LearningComponentStatus } from '@/lib/learning-loop/types';

interface ComponentDetailsDialogProps {
  readonly component: KnowledgeComponent;
  readonly learningState?: ComponentLearningState;
  readonly isChinese: boolean;
  readonly onClose: () => void;
  readonly onMarkConfusion: () => void;
  readonly onStartRepair: () => void;
}

const EVIDENCE_PREVIEW_COUNT = 4;

export function ComponentDetailsDialog({
  component,
  learningState,
  isChinese,
  onClose,
  onMarkConfusion,
  onStartRepair,
}: ComponentDetailsDialogProps) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const status = learningState?.status ?? 'not_started';
  const evidence = learningState?.evidence ?? [];
  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(-EVIDENCE_PREVIEW_COUNT);
  const hasMoreEvidence = evidence.length > EVIDENCE_PREVIEW_COUNT;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        data-testid="knowledge-component-details"
        className="flex h-[min(640px,calc(100dvh-32px))] w-[min(520px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl bg-background p-0"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              {isChinese ? '知识构件' : 'Knowledge component'}
            </p>
            <DialogTitle className="mt-1 text-base font-semibold leading-6">
              {component.title}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isChinese ? '关闭构件详情' : 'Close component details'}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {isChinese ? '理解状态' : 'Understanding status'}
            </span>
            <span className="font-semibold text-foreground">{statusLabel(status, isChinese)}</span>
          </div>

          {component.objective && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">
                {isChinese ? '构建目标' : 'Learning objective'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground/85">{component.objective}</p>
            </section>
          )}

          {component.keyPoints.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">
                {isChinese ? '关键支点' : 'Key points'}
              </h3>
              <ul className="mt-2 space-y-2">
                {component.keyPoints.map((point) => (
                  <li key={point} className="flex gap-2 text-sm leading-6 text-foreground/85">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold text-muted-foreground">
              {isChinese
                ? `理解证据 · ${evidence.length} 条`
                : `Understanding evidence · ${evidence.length}`}
            </h3>
            {evidence.length > 0 ? (
              <>
                <ul className="mt-2 space-y-2" data-testid="learning-evidence-list">
                  {visibleEvidence.map((item) => (
                    <li
                      key={item.eventId}
                      className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-5 text-foreground/80"
                    >
                      {evidenceLabel(item.type, item.outcome, isChinese)}
                    </li>
                  ))}
                </ul>
                {hasMoreEvidence && (
                  <button
                    type="button"
                    aria-expanded={showAllEvidence}
                    onClick={() => setShowAllEvidence((value) => !value)}
                    className="mt-2 min-h-10 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    {showAllEvidence
                      ? isChinese
                        ? '收起历史证据'
                        : 'Show fewer evidence items'
                      : isChinese
                        ? `查看全部 ${evidence.length} 条证据`
                        : `View all ${evidence.length} evidence items`}
                  </button>
                )}
              </>
            ) : (
              <p className="mt-2 rounded-xl bg-muted/50 px-3 py-3 text-xs leading-5 text-muted-foreground">
                {isChinese
                  ? '尚未记录理解证据。进入环节不等于已理解，完成检测或标记疑问后会在这里显示依据。'
                  : 'No understanding evidence yet. Visiting a scene does not prove understanding; checks and explicit questions will appear here.'}
              </p>
            )}
          </section>

          <p className="border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground">
            {component.source === 'outline-derived'
              ? isChinese
                ? '目标与关键点来自课程生成大纲。'
                : 'Objective and key points come from the course outline.'
              : isChinese
                ? '此构件由当前教学场景派生。'
                : 'This component is derived from the current scene.'}
          </p>
        </div>

        <footer className="shrink-0 border-t border-border/70 bg-background px-5 py-4">
          <button
            type="button"
            onClick={status === 'needs_revisit' ? onStartRepair : onMarkConfusion}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {status === 'needs_revisit'
              ? isChinese
                ? '开始补学'
                : 'Start repair path'
              : isChinese
                ? '这里没懂'
                : "I don't understand this yet"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(status: LearningComponentStatus, isChinese: boolean): string {
  const labels: Record<LearningComponentStatus, readonly [string, string]> = {
    not_started: ['未开始', 'Not started'],
    in_progress: ['构建中', 'Building'],
    evidence_available: ['已有证据', 'Evidence available'],
    needs_revisit: ['建议回看', 'Revisit suggested'],
    verified: ['已有验证', 'Verified'],
  };
  return labels[status][isChinese ? 0 : 1];
}

function evidenceLabel(type: string, outcome: string, isChinese: boolean): string {
  if (type === 'scene_visited') return isChinese ? '已进入该知识构件' : 'Component visited';
  if (type === 'learner_confusion') return isChinese ? '你标记了“这里没懂”' : 'Marked as unclear';
  if (type === 'quiz_reviewed') {
    if (outcome === 'supports') return isChinese ? '理解检测回答正确' : 'Quiz answer correct';
    return isChinese ? '理解检测需要回看' : 'Quiz answer needs review';
  }
  if (type === 'verification_passed') return isChinese ? '补学验证通过' : 'Verification passed';
  if (type === 'verification_failed') return isChinese ? '补学验证未通过' : 'Verification failed';
  return isChinese ? '已记录一条学习证据' : 'Learning evidence recorded';
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { animate, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { FileText, HelpCircle, Gamepad2, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import type { Scene, SceneType } from '@/lib/types/stage';
import {
  completeSummaryForScenes,
  pendingCompleteSummary,
  readSceneQuizAnswers,
  summarizeScenes,
} from '@/lib/classroom/complete-summary';
import { loadQuizAttemptState } from '@/lib/quiz/runtime';
import { createLogger } from '@/lib/logger';
import { isLearningLoopEnabled } from '@/lib/config/feature-flags';
import { trackLearningLoopEvent } from '@/lib/learning-loop/analytics';
import { buildKnowledgeModel } from '@/lib/learning-loop/knowledge-model';
import { buildKnowledgeConstructionReport } from '@/lib/learning-loop/report';
import type {
  KnowledgeConstructionReport,
  LearningComponentStatus,
} from '@/lib/learning-loop/types';
import { useLearningJourney } from '@/lib/learning-loop/use-learning-journey';

const log = createLogger('ClassroomComplete');

const SCENE_TYPE_ICONS: Record<SceneType, typeof FileText> = {
  slide: FileText,
  quiz: HelpCircle,
  interactive: Gamepad2,
  pbl: Puzzle,
};

const TYPE_ORDER: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

const CONFETTI_COLORS = [
  '#fbbf24',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#3b82f6',
  '#10b981',
];

function encouragementKey(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  w: number;
  h: number;
  duration: number;
  delay: number;
  round: boolean;
}

function makeConfetti(count: number): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const distance = 180 + Math.random() * 280;
    const w = 6 + Math.random() * 6;
    arr.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 50,
      rotate: (Math.random() - 0.5) * 720,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w,
      h: Math.random() > 0.3 ? w * 0.4 : w,
      duration: 1.0 + Math.random() * 0.9,
      delay: Math.random() * 0.12,
      round: Math.random() > 0.72,
    });
  }
  return arr;
}

function Confetti() {
  const prefersReducedMotion = useReducedMotion();
  const particles = useMemo(() => makeConfetti(55), []);
  if (prefersReducedMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.2 }}
          animate={{
            x: p.x,
            y: p.y + 220,
            opacity: 0,
            rotate: p.rotate,
            scale: 1,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.1, 0.5, 0.4, 1] }}
          style={{
            position: 'absolute',
            width: p.w,
            height: p.h,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : 2,
          }}
        />
      ))}
    </div>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M10 1 L12 8 L19 10 L12 12 L10 19 L8 12 L1 10 L8 8 Z" fill="currentColor" />
    </svg>
  );
}

function Sparkles() {
  const prefersReducedMotion = useReducedMotion();
  const sparkles = useMemo(
    () => [
      { x: -95, y: -40, size: 14, delay: 0.8, repeatDelay: 0.8 },
      { x: 95, y: -20, size: 18, delay: 1.1, repeatDelay: 1.0 },
      { x: -78, y: 55, size: 11, delay: 1.35, repeatDelay: 1.2 },
      { x: 82, y: 62, size: 15, delay: 1.55, repeatDelay: 0.9 },
      { x: 0, y: -88, size: 10, delay: 1.75, repeatDelay: 1.1 },
    ],
    [],
  );
  if (prefersReducedMotion) return null;

  return (
    <>
      {sparkles.map((s, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute text-amber-300 dark:text-amber-200"
          style={{
            width: s.size,
            height: s.size,
            left: `calc(50% + ${s.x}px - ${s.size / 2}px)`,
            top: `calc(50% + ${s.y}px - ${s.size / 2}px)`,
          }}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1, 0.7, 1, 0], opacity: [0, 1, 0.7, 1, 0], rotate: 180 }}
          transition={{
            duration: 2.2,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: s.repeatDelay,
            ease: 'easeInOut',
          }}
        >
          <Sparkle className="w-full h-full" />
        </motion.div>
      ))}
    </>
  );
}

function TrophySvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden>
      <defs>
        <linearGradient id="tc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="35%" stopColor="#fbbf24" />
          <stop offset="75%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="tc-gold-light" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="tc-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fffbeb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Handles */}
      <path
        d="M 28 32 Q 6 32 8 60 Q 10 82 32 86"
        fill="none"
        stroke="url(#tc-gold)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M 92 32 Q 114 32 112 60 Q 110 82 88 86"
        fill="none"
        stroke="url(#tc-gold)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Cup */}
      <path d="M 25 18 L 95 18 L 95 50 Q 95 90 60 100 Q 25 90 25 50 Z" fill="url(#tc-gold)" />
      {/* Shine */}
      <path d="M 33 22 Q 32 60 42 88 L 38 88 Q 30 60 31 22 Z" fill="url(#tc-shine)" />
      {/* Rim */}
      <ellipse cx="60" cy="19" rx="36" ry="4.5" fill="#fde68a" />
      <ellipse
        cx="60"
        cy="19"
        rx="36"
        ry="4.5"
        fill="none"
        stroke="#b45309"
        strokeWidth="0.6"
        opacity="0.35"
      />
      {/* Star */}
      <path
        d="M 60 42 L 63.6 52.3 L 74.5 52.3 L 65.7 58.7 L 69 69 L 60 62.7 L 51 69 L 54.3 58.7 L 45.5 52.3 L 56.4 52.3 Z"
        fill="#ffffff"
        opacity="0.92"
      />
      {/* Stem */}
      <path d="M 52 100 L 68 100 L 66 116 L 54 116 Z" fill="url(#tc-gold)" />
      {/* Base tiers */}
      <rect x="40" y="116" width="40" height="7" rx="2" fill="url(#tc-gold-light)" />
      <rect x="32" y="123" width="56" height="9" rx="2" fill="url(#tc-gold)" />
      <rect x="28" y="132" width="64" height="6" rx="3" fill="url(#tc-gold-light)" />
    </svg>
  );
}

function AnimatedCounter({
  value,
  delay = 0,
  duration = 0.9,
}: {
  value: number;
  delay?: number;
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(0, value, {
      delay,
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay, duration, prefersReducedMotion]);

  return <>{prefersReducedMotion ? value : display}</>;
}

function QuizRing({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="tc-ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-amber-200/70 dark:text-amber-900/40"
        />
        <motion.circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="url(#tc-ring-gold)"
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{
            duration: prefersReducedMotion ? 0 : 1.1,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-black text-amber-700 dark:text-amber-300">
          <AnimatedCounter value={pct} delay={delay} duration={1.0} />
          <span className="text-sm font-bold">%</span>
        </span>
      </div>
    </div>
  );
}

interface ClassroomCompletePageProps {
  readonly scenes: Scene[];
  readonly title: string;
  readonly knowledgeReport?: KnowledgeConstructionReport;
}

export function ClassroomCompletePage({
  scenes,
  title,
  knowledgeReport,
}: ClassroomCompletePageProps) {
  const { t, locale } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const [resolvedSummary, setResolvedSummary] = useState(() => ({
    scenes,
    summary: pendingCompleteSummary(scenes),
  }));
  const summary = completeSummaryForScenes(scenes, resolvedSummary);

  useEffect(() => {
    let cancelled = false;
    void summarizeScenes(scenes, async (sceneId) => {
      const scene = scenes.find((candidate) => candidate.id === sceneId);
      try {
        return await readSceneQuizAnswers(scene, loadQuizAttemptState);
      } catch (error) {
        log.warn(`Failed to load quiz summary for scene ${sceneId}:`, error);
        return undefined;
      }
    }).then((next) => {
      if (!cancelled) setResolvedSummary({ scenes, summary: next });
    });
    return () => {
      cancelled = true;
    };
  }, [scenes]);

  const dateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale).format(new Date());
    } catch {
      return new Date().toLocaleDateString();
    }
  }, [locale]);

  const trailItems = TYPE_ORDER.filter((type) => (summary.countsByType[type] ?? 0) > 0).map(
    (type) => ({
      type,
      count: summary.countsByType[type] ?? 0,
      Icon: SCENE_TYPE_ICONS[type],
      label: t(`classroomComplete.trailLabels.${type}`),
    }),
  );

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? 'always' : 'user'}>
      <section
        className="absolute inset-0 z-[105] flex items-center justify-center overflow-auto"
        aria-label={t('classroomComplete.title')}
      >
        {/* Single-shot announcement for screen readers — replaces the noisy
            outer aria-live region that used to wrap the live-updating counters. */}
        <span className="sr-only" role="status">
          {t('classroomComplete.title')}
        </span>
        {/* Base background */}
        <div className="absolute inset-0 bg-background" />
        {/* Radial glow */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(251, 191, 36, 0.32), rgba(249, 115, 22, 0.12) 38%, transparent 68%)',
          }}
        />
        {/* Confetti */}
        <Confetti />

        {/* Content */}
        <div className="relative flex flex-col items-center gap-6 max-w-2xl w-full px-8 py-10">
          {/* Trophy + halo + sparkles */}
          <div className="relative" style={{ width: 200, height: 200 }}>
            <motion.div
              aria-hidden
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.9, 1.15, 0.95, 1.1], opacity: [0, 0.55, 0.4, 0.5] }}
              transition={{
                delay: 0.15,
                duration: 2.6,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(251, 191, 36, 0.5), rgba(249, 115, 22, 0.12) 55%, transparent 72%)',
                filter: 'blur(14px)',
              }}
            />
            <motion.div
              aria-hidden
              initial={{ y: 44, scale: 0.4, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 148, height: 185 }}
              >
                <TrophySvg className="w-full h-full drop-shadow-[0_10px_18px_rgba(180,83,9,0.35)]" />
              </motion.div>
            </motion.div>
            <Sparkles />
          </div>

          {/* Ribbon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.65, type: 'spring', stiffness: 280, damping: 18 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/30"
          >
            <Sparkle className="w-3 h-3" />
            {t('classroomComplete.title')}
            <Sparkle className="w-3 h-3" />
          </motion.div>

          {/* Title + date */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78, duration: 0.4, ease: 'easeOut' }}
            className="text-center space-y-1.5"
          >
            <h2 className="text-3xl md:text-4xl font-black leading-tight bg-gradient-to-br from-amber-700 via-orange-600 to-amber-800 dark:from-amber-200 dark:via-orange-200 dark:to-amber-300 bg-clip-text text-transparent">
              {title || t('classroomComplete.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </motion.div>

          {/* Stats cards */}
          {trailItems.length > 0 && (
            <div
              className={cn(
                'grid gap-3 w-full',
                trailItems.length === 1 && 'grid-cols-1 max-w-[180px]',
                trailItems.length === 2 && 'grid-cols-2 max-w-md',
                trailItems.length === 3 && 'grid-cols-3',
                trailItems.length === 4 && 'grid-cols-2 sm:grid-cols-4',
              )}
            >
              {trailItems.map(({ type, count, Icon, label }, idx) => {
                const cardDelay = 0.96 + idx * 0.08;
                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, y: 14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: cardDelay,
                      type: 'spring',
                      stiffness: 260,
                      damping: 20,
                    }}
                    className="rounded-2xl bg-card/90 border border-border shadow-sm px-4 py-4 flex flex-col items-center gap-1.5 backdrop-blur-sm"
                  >
                    <Icon
                      className="w-6 h-6 text-amber-500 dark:text-amber-400"
                      strokeWidth={1.8}
                    />
                    <div className="text-3xl font-black text-foreground leading-none">
                      <AnimatedCounter value={count} delay={cardDelay + 0.15} />
                    </div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {label}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {knowledgeReport && knowledgeReport.components.length > 0 && (
            <KnowledgeReportCard report={knowledgeReport} isChinese={locale === 'zh-CN'} />
          )}

          {/* Quiz card */}
          {summary.quiz && (
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.2, type: 'spring', stiffness: 220, damping: 20 }}
              className="w-full rounded-2xl bg-card border border-border px-6 py-5 shadow-md shadow-primary/10"
            >
              <div className="flex items-center gap-5">
                <QuizRing pct={summary.quiz.pct} delay={1.3} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-amber-700 dark:text-amber-300">
                    {t('classroomComplete.quizScoreLabel', {
                      correct: summary.quiz.correct,
                      total: summary.quiz.total,
                    })}
                  </div>
                  <div className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
                    {t(`classroomComplete.encouragement.${encouragementKey(summary.quiz.pct)}`)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </MotionConfig>
  );
}

function KnowledgeReportCard({
  report,
  isChinese,
}: {
  readonly report: KnowledgeConstructionReport;
  readonly isChinese: boolean;
}) {
  const labels: Record<LearningComponentStatus, readonly [string, string]> = {
    not_started: ['未开始', 'Not started'],
    in_progress: ['构建中', 'Building'],
    evidence_available: ['已有证据', 'Evidence available'],
    needs_revisit: ['建议回看', 'Revisit suggested'],
    verified: ['已有验证', 'Verified'],
  };
  const verified = report.components.filter((item) => item.status === 'verified').length;
  const revisit = report.unresolvedComponentIds.length;
  useEffect(() => {
    trackLearningLoopEvent({
      name: 'learning_loop_report_viewed',
      stageId: report.stageId,
    });
  }, [report.stageId]);
  return (
    <motion.div
      data-testid="knowledge-construction-report"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.4 }}
      className="w-full rounded-3xl border border-primary/15 bg-card/95 p-5 shadow-lg shadow-primary/5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
            {isChinese ? '知识构建报告' : 'Knowledge construction report'}
          </p>
          <h3 className="mt-1 text-base font-bold text-foreground">
            {isChinese ? '基于本次学习证据' : 'Based on this session’s evidence'}
          </h3>
        </div>
        <div className="flex gap-2 text-[10px]">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">
            {isChinese ? `已有验证 ${verified}` : `Verified ${verified}`}
          </span>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-300">
            {isChinese ? `建议回看 ${revisit}` : `Revisit ${revisit}`}
          </span>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {report.components.map((item) => (
          <div
            key={item.componentId}
            className="rounded-2xl border border-border/65 bg-background/70 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold leading-5 text-foreground">{item.title}</p>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  item.status === 'verified' &&
                    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  item.status === 'needs_revisit' &&
                    'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  item.status !== 'verified' &&
                    item.status !== 'needs_revisit' &&
                    'bg-muted text-muted-foreground',
                )}
              >
                {labels[item.status][isChinese ? 0 : 1]}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.explanation}</p>
            {item.suggestedNextAction && (
              <p className="mt-1 text-[11px] font-medium leading-5 text-primary">
                {item.suggestedNextAction}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground/75">
        {isChinese
          ? '状态仅反映当前已记录证据，不代表正式成绩或永久掌握度。'
          : 'Statuses reflect recorded evidence only; they are not grades or permanent mastery scores.'}
      </p>
    </motion.div>
  );
}

export function ClassroomCompletePageConnected() {
  const { locale } = useI18n();
  const stage = useStageStore((s) => s.stage);
  const scenes = useStageStore((s) => s.scenes);
  const outlines = useStageStore((s) => s.outlines);
  const learningLoopEnabled = isLearningLoopEnabled();
  const { evidence } = useLearningJourney(stage?.id, learningLoopEnabled);
  const knowledgeReport = useMemo(() => {
    if (!learningLoopEnabled || !stage) return undefined;
    return buildKnowledgeConstructionReport({
      model: buildKnowledgeModel(stage, scenes, outlines),
      evidence,
      language: locale,
    });
  }, [evidence, learningLoopEnabled, locale, outlines, scenes, stage]);
  return (
    <ClassroomCompletePage
      scenes={scenes}
      title={stage?.name ?? ''}
      knowledgeReport={knowledgeReport}
    />
  );
}

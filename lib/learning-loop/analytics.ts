export type LearningLoopAnalyticsEventName =
  | 'learning_loop_component_viewed'
  | 'learning_loop_evidence_opened'
  | 'learning_loop_repair_suggested'
  | 'learning_loop_repair_started'
  | 'learning_loop_repair_step_completed'
  | 'learning_loop_verification_completed'
  | 'learning_loop_report_viewed'
  | 'learning_loop_generation_failed';

export interface LearningLoopAnalyticsEvent {
  name: LearningLoopAnalyticsEventName;
  stageId: string;
  componentId?: string;
  outcome?: string;
  occurredAt: string;
}

export const LEARNING_LOOP_ANALYTICS_EVENT = 'openmaic:learning-loop-analytics';

/**
 * Product analytics are deliberately separate from learner evidence. This
 * browser event is an integration seam for deployments with an analytics
 * adapter; it is never read by the learning-state fold.
 */
export function trackLearningLoopEvent(
  event: Omit<LearningLoopAnalyticsEvent, 'occurredAt'>,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<LearningLoopAnalyticsEvent>(LEARNING_LOOP_ANALYTICS_EVENT, {
      detail: { ...event, occurredAt: new Date().toISOString() },
    }),
  );
}

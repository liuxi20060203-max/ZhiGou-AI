'use client';

import { useCallback, useEffect, useState } from 'react';

import type { LearningEvidence } from './types';
import { LEARNING_JOURNEY_CHANGED_EVENT, readLearningEvidence } from './runtime';

export function useLearningJourney(stageId: string | undefined, enabled: boolean) {
  const [evidence, setEvidence] = useState<LearningEvidence[]>([]);
  const [error, setError] = useState<unknown>();

  const refresh = useCallback(async () => {
    if (!enabled || !stageId) {
      setEvidence([]);
      setError(undefined);
      return;
    }
    try {
      setEvidence(await readLearningEvidence(stageId));
      setError(undefined);
    } catch (nextError) {
      setError(nextError);
    }
  }, [enabled, stageId]);

  useEffect(() => {
    if (!enabled || !stageId) return;
    let cancelled = false;
    readLearningEvidence(stageId)
      .then((nextEvidence) => {
        if (cancelled) return;
        setEvidence(nextEvidence);
        setError(undefined);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) setError(nextError);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, stageId]);

  useEffect(() => {
    if (!enabled || !stageId) return;
    const handleChanged = (event: Event) => {
      const changedStageId = (event as CustomEvent<{ stageId?: string }>).detail?.stageId;
      if (changedStageId === stageId) void refresh();
    };
    window.addEventListener(LEARNING_JOURNEY_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(LEARNING_JOURNEY_CHANGED_EVENT, handleChanged);
  }, [enabled, refresh, stageId]);

  return { evidence, error, refresh };
}

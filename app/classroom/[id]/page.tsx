'use client';

import { Stage } from '@/components/stage';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { useStageStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store/settings';
import { claimStageSceneLoadToken, isCurrentStageSceneLoadToken } from '@/lib/store/stage';
import { loadImageMapping } from '@/lib/utils/image-storage';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSceneGenerator } from '@/lib/hooks/use-scene-generator';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useWhiteboardHistoryStore } from '@/lib/store/whiteboard-history';
import { createLogger } from '@/lib/logger';
import { MediaStageProvider } from '@/lib/contexts/media-stage-context';
import { generateMediaForOutlines } from '@/lib/media/media-orchestrator';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { fetchStageMeta } from '@/lib/classroom/stage-meta-client';
import { noteStageOwnership } from '@/lib/classroom/stage-ownership-signal';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useBrand } from '@/lib/brand/brand-context';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import {
  applyClassroomStageAndScenes,
  defaultClassroomLoadDeps,
  runClassroomLoad,
} from '@/lib/classroom/load-classroom';

const log = createLogger('Classroom');

function ClassroomLoadingState() {
  const { t } = useI18n();
  const brand = useBrand();

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--primary)_11%,transparent),transparent_44%)]" />
      <div className="relative flex w-full max-w-sm flex-col items-center rounded-[28px] border border-border/70 bg-card/90 px-8 py-10 text-center shadow-[0_28px_80px_-48px_rgba(16,42,67,0.65)] backdrop-blur-xl">
        <img src={brand.logoSrc} alt={brand.productName} className="h-8 w-auto dark:hidden" />
        <img
          src={brand.darkLogoSrc}
          alt={brand.productName}
          className="hidden h-8 w-auto dark:block"
        />
        <span className="mt-8 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Loader2 className="size-7 animate-spin" aria-hidden="true" />
        </span>
        <p className="mt-5 text-base font-semibold text-foreground">
          {t('common.loadingClassroom')}
        </p>
      </div>
    </div>
  );
}

function ClassroomErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t, locale } = useI18n();
  const brand = useBrand();

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-4"
      role="alert"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--destructive)_8%,transparent),transparent_44%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center rounded-[28px] border border-border/70 bg-card/90 px-8 py-10 text-center shadow-[0_28px_80px_-48px_rgba(16,42,67,0.65)] backdrop-blur-xl">
        <img src={brand.logoSrc} alt={brand.productName} className="h-8 w-auto dark:hidden" />
        <img
          src={brand.darkLogoSrc}
          alt={brand.productName}
          className="hidden h-8 w-auto dark:block"
        />
        <span className="mt-8 flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertCircle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          {locale === 'zh-CN' ? '课堂加载失败' : 'Unable to load classroom'}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{error}</p>
        <Button onClick={onRetry} className="mt-7 w-full sm:w-auto sm:min-w-40">
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </div>
    </div>
  );
}

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params?.id as string;

  const { loadFromStorage } = useStageStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generationStartedRef = useRef(false);

  const { generateRemaining, retrySingleOutline, stop } = useSceneGenerator({
    onComplete: () => {
      log.info('[Classroom] All scenes generated');
    },
  });

  const loadClassroom = useCallback(
    async (isEffectCurrent: () => boolean = () => true) => {
      const loadToken = claimStageSceneLoadToken();
      const isCurrent = () => isEffectCurrent() && isCurrentStageSceneLoadToken(loadToken);

      await runClassroomLoad({
        classroomId,
        loadToken,
        isCurrent,
        loadFromStorage,
        getCurrentStage: () => useStageStore.getState().stage,
        fetchClassroom: defaultClassroomLoadDeps.fetchClassroom,
        applyFallbackScenes: (args) =>
          defaultClassroomLoadDeps.applyFallbackScenes({
            ...args,
            isCurrent,
            applyStageAndScenes: applyClassroomStageAndScenes,
          }),
        loadRestoredMediaTasks: defaultClassroomLoadDeps.loadRestoredMediaTasks,
        applyRestoredMediaTasks: (restored) =>
          defaultClassroomLoadDeps.applyRestoredMediaTasks(restored, isCurrent),
        discardRestoredMediaTasks: defaultClassroomLoadDeps.discardRestoredMediaTasks,
        loadLegacyAgentFallbacks: defaultClassroomLoadDeps.loadLegacyAgentFallbacks,
        commitMigratedAgentConfigs: defaultClassroomLoadDeps.commitMigratedAgentConfigs,
        applyGeneratedAgents: defaultClassroomLoadDeps.applyGeneratedAgents,
        getSettings: () => useSettingsStore.getState(),
        getAgent: (id) => useAgentRegistry.getState().getAgent(id),
        restoreAgentSelection: defaultClassroomLoadDeps.restoreAgentSelection,
        setError,
        setLoading,
        log,
      });

      // The stage-meta sidecar resolves the viewer-facing ownership facts the
      // document seam does not carry — `isOwner` decides read-only vs editable
      // (see `stage-meta-client.ts`). Run it strictly AFTER the load applied
      // its defaults so its answer wins, and fire it without blocking the
      // render that already happened.
      if (isEffectCurrent()) {
        void fetchStageMeta(classroomId)
          .then((result) => {
            if (!isEffectCurrent()) return;
            if (result.outcome === 'found') {
              noteStageOwnership(classroomId, true, {
                isOwner: result.meta.isOwner,
              });
              useStageStore.getState().setViewerAccess({
                isOwner: result.meta.isOwner,
              });
            } else if (result.outcome === 'unavailable') {
              // A silent sidecar is not "this is a stranger's course": record
              // the outage so nothing treats `isOwner === false` as a visitor
              // conclusion. The edit gate stays on the upstream defaults.
              noteStageOwnership(classroomId, false, null);
            } else {
              // 'absent' — no sidecar row for this id. This classroom also
              // serves local-only courses, so the upstream editable default
              // stays; the server's owner-scoped writes remain the authority.
              noteStageOwnership(classroomId, true, null);
            }
          })
          .catch(() => noteStageOwnership(classroomId, false, null));
      }
    },
    [classroomId, loadFromStorage],
  );

  useEffect(() => {
    // Reset loading state on course switch to unmount Stage during transition,
    // preventing stale data from syncing back to the new course
    /* eslint-disable react-hooks/set-state-in-effect -- Course switch must hide stale Stage before async load */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    generationStartedRef.current = false;

    // Clear previous classroom's media tasks to prevent cross-classroom contamination.
    // Placeholder IDs (gen_img_1, gen_vid_1) are NOT globally unique across stages,
    // so stale tasks from a previous classroom would shadow the new one's.
    const mediaStore = useMediaGenerationStore.getState();
    mediaStore.revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    // Clear whiteboard history to prevent snapshots from a previous course leaking in.
    useWhiteboardHistoryStore.getState().clearHistory();

    let cancelled = false;
    loadClassroom(() => !cancelled);

    // Cancel ongoing generation when classroomId changes or component unmounts
    return () => {
      cancelled = true;
      stop();
    };
  }, [classroomId, loadClassroom, stop]);

  // Auto-resume generation for pending outlines
  useEffect(() => {
    if (loading || error || generationStartedRef.current) return;

    const state = useStageStore.getState();
    const { outlines, scenes, stage, generationComplete } = state;

    // Check if there are pending outlines. A finished deck is frozen for
    // editing: deleting a slide leaves its outline orphaned, but that must not
    // be treated as an interrupted generation and regenerated. Only resume
    // when generation has not completed.
    const completedOrders = new Set(scenes.map((s) => s.order));
    const hasPending = !generationComplete && outlines.some((o) => !completedOrders.has(o.order));

    if (hasPending && stage) {
      generationStartedRef.current = true;

      // Load generation params from sessionStorage (stored by generation-preview before navigating)
      const genParamsStr = sessionStorage.getItem('generationParams');
      const params = genParamsStr ? JSON.parse(genParamsStr) : {};

      // Reconstruct imageMapping for the resumed generation. A server-backed
      // deployment stored allocated asset ids on the session's pdfImages (RFC
      // #1153 part 2 B): the extracted images are pool assets, so generation
      // is fed by id and the routes resolve the bytes server-side. Per source
      // (N4) the mapping may MIX allocated asset ids and IndexedDB data URLs —
      // a source whose cache write failed materialized its own images — so the
      // resume mapping merges both, instead of choosing one transport for the
      // whole set and silently dropping the other half.
      const pdfImages = (params.pdfImages || []) as Array<
        { id: string; assetId?: string; storageId?: string } & Record<string, unknown>
      >;
      const finishResume = (imageMapping: Record<string, string>) =>
        generateRemaining({
          pdfImages: params.pdfImages,
          imageMapping,
          stageInfo: {
            name: stage.name || '',
            description: stage.description,
            style: stage.style,
          },
          agents: params.agents,
          userProfile: params.userProfile,
          languageDirective: params.languageDirective || stage.languageDirective,
        });

      const imageMapping: Record<string, string> = {};
      for (const img of pdfImages) {
        if (img.assetId) imageMapping[img.id] = img.assetId;
      }
      const storageIds = pdfImages
        .filter((img) => !img.assetId && img.storageId)
        .map((img) => img.storageId as string);
      void (async () => {
        if (storageIds.length > 0) {
          Object.assign(imageMapping, await loadImageMapping(storageIds));
        }
        finishResume(imageMapping);
      })();
    } else if (outlines.length > 0 && stage) {
      // All scenes are generated, but some media may not have finished.
      // Resume media generation for any tasks not yet in IndexedDB.
      // generateMediaForOutlines skips already-completed tasks automatically.
      generationStartedRef.current = true;
      // The deck reached the classroom already fully materialized (e.g. a
      // single-slide course, or a deck whose last slide finished in
      // generation-preview), so generateRemaining's completion path never
      // ran. Record completion now so a later edit/delete is not treated as
      // an interrupted generation. No-op if already complete or not all
      // outlines have scenes.
      useStageStore.getState().markGenerationCompleteIfDone();
      // Resume media only for outlines that still have a scene. On a finished
      // deck the user may have deleted a slide, leaving an orphaned outline;
      // generating its media would waste API calls on a slide that is gone.
      const materializedOrders = new Set(scenes.map((s) => s.order));
      const materializedOutlines = outlines.filter((o) => materializedOrders.has(o.order));
      generateMediaForOutlines(materializedOutlines, stage.id).catch((err) => {
        log.warn('[Classroom] Media generation resume error:', err);
      });
    }
  }, [loading, error, generateRemaining]);

  return (
    <ThemeProvider>
      <MediaStageProvider value={classroomId}>
        <div className="h-screen flex flex-col overflow-hidden">
          {loading ? (
            <ClassroomLoadingState />
          ) : error ? (
            <ClassroomErrorState
              error={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                void loadClassroom();
              }}
            />
          ) : (
            <Stage onRetryOutline={retrySingleOutline} />
          )}
        </div>
      </MediaStageProvider>
    </ThemeProvider>
  );
}

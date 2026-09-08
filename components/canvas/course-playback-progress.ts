import type { EngineMode } from '@/lib/playback';

interface CourseProgressInput {
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly currentActionIndex: number;
  readonly totalActions: number;
  readonly engineMode: EngineMode;
  readonly playbackCompleted: boolean;
}

export function getCoursePlaybackProgress({
  currentSceneIndex,
  scenesCount,
  currentActionIndex,
  totalActions,
  engineMode,
  playbackCompleted,
}: CourseProgressInput): number {
  if (playbackCompleted) return 100;
  if (scenesCount <= 0 || currentSceneIndex < 0) return 0;

  const sceneIndex = Math.min(currentSceneIndex, scenesCount - 1);
  const hasStarted = engineMode !== 'idle' || currentActionIndex > 0;
  const actionProgress =
    totalActions > 0 && hasStarted
      ? Math.min(Math.max(currentActionIndex + 1, 0), totalActions) / totalActions
      : 0;

  return Math.min(100, Math.max(0, ((sceneIndex + actionProgress) / scenesCount) * 100));
}

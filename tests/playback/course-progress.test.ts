import { describe, expect, it } from 'vitest';
import { getCoursePlaybackProgress } from '@/lib/playback/course-progress';

describe('getCoursePlaybackProgress', () => {
  it('starts at zero before classroom playback begins', () => {
    expect(
      getCoursePlaybackProgress({
        currentSceneIndex: 0,
        scenesCount: 2,
        currentActionIndex: 0,
        totalActions: 4,
        engineMode: 'idle',
        playbackCompleted: false,
      }),
    ).toBe(0);
  });

  it('combines scene and action progress', () => {
    expect(
      getCoursePlaybackProgress({
        currentSceneIndex: 1,
        scenesCount: 2,
        currentActionIndex: 1,
        totalActions: 4,
        engineMode: 'playing',
        playbackCompleted: false,
      }),
    ).toBe(75);
  });

  it('reports completion as one hundred percent', () => {
    expect(
      getCoursePlaybackProgress({
        currentSceneIndex: 0,
        scenesCount: 2,
        currentActionIndex: 0,
        totalActions: 0,
        engineMode: 'idle',
        playbackCompleted: true,
      }),
    ).toBe(100);
  });
});

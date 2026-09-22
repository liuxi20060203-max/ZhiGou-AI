import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('learning panel workspace boundary', () => {
  it('mounts the learning bridge only outside hosted Workspace classrooms', () => {
    const stageSource = readFileSync(resolve(process.cwd(), 'components/stage.tsx'), 'utf8');
    const playbackSource = readFileSync(
      resolve(process.cwd(), 'components/edit/PlaybackChromeRoot.tsx'),
      'utf8',
    );
    expect(stageSource).toContain('showLearningTaskPanel={!hosted}');
    expect(playbackSource).toContain('{showLearningTaskPanel && stage?.id ? (');
    expect(playbackSource).toContain('<LearningTaskBridge');
    expect(playbackSource).toContain('boundaryRef={learningTaskPanelBoundaryRef}');
    expect(playbackSource.indexOf('<LearningTaskBridge')).toBeLessThan(
      playbackSource.indexOf('classroomShellStyles.assistantSlot'),
    );
  });

  it('portals the open panel above body-hosted experiment iframes', () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), 'components/learning/learning-task-panel.tsx'),
      'utf8',
    );
    expect(panelSource).toContain('createPortal(');
    expect(panelSource).toContain('document.fullscreenElement ?? document.body');
    expect(panelSource).toContain('getLearningTaskPanelBounds(rect)');
  });
});

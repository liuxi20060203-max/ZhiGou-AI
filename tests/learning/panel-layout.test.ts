import { describe, expect, it } from 'vitest';
import { getLearningTaskPanelBounds } from '@/lib/learning/panel-layout';

describe('learning task panel layout', () => {
  it('stays inside the central classroom column instead of covering the assistant', () => {
    const bounds = getLearningTaskPanelBounds({ top: 0, right: 1618, width: 1318, height: 1117 });
    expect(bounds).toEqual({ top: 16, left: 1222, width: 380, height: 1085 });
    expect(bounds.left + bounds.width).toBeLessThan(1618);
  });

  it('shrinks with a narrow classroom column', () => {
    const bounds = getLearningTaskPanelBounds({ top: 72, right: 360, width: 280, height: 600 });
    expect(bounds).toEqual({ top: 88, left: 96, width: 248, height: 568 });
  });
});

export interface LearningTaskPanelBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Keep the body-portaled drawer within the classroom's central content column. */
export function getLearningTaskPanelBounds(
  rect: Pick<DOMRect, 'top' | 'right' | 'width' | 'height'>,
): LearningTaskPanelBounds {
  const inset = 16;
  const width = Math.max(0, Math.min(380, rect.width - inset * 2));
  return {
    top: rect.top + inset,
    left: rect.right - inset - width,
    width,
    height: Math.max(0, rect.height - inset * 2),
  };
}

import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  formatVideoTime,
  VideoProgressBar,
} from '@/components/slide-renderer/components/element/VideoElement/VideoProgressBar';

describe('VideoProgressBar', () => {
  it('formats short and long video durations', () => {
    expect(formatVideoTime(0)).toBe('0:00');
    expect(formatVideoTime(65.9)).toBe('1:05');
    expect(formatVideoTime(3661)).toBe('1:01:01');
    expect(formatVideoTime(Number.NaN)).toBe('--:--');
  });

  it('renders a persistent, accessible seek control before metadata loads', () => {
    const html = renderToStaticMarkup(
      createElement(VideoProgressBar, {
        videoRef: createRef<HTMLVideoElement>(),
        ariaLabel: '视频播放进度',
      }),
    );

    expect(html).toContain('data-testid="video-progress-control"');
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-label="视频播放进度"');
    expect(html).toContain('--:--');
  });
});

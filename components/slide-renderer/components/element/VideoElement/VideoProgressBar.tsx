'use client';

import { useEffect, useState, type RefObject } from 'react';

interface VideoProgressBarProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly ariaLabel: string;
}

export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function VideoProgressBar({ videoRef, ariaLabel }: VideoProgressBarProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncCurrentTime = () =>
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    const syncDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const resetProgress = () => {
      setCurrentTime(0);
      setDuration(0);
    };

    syncCurrentTime();
    syncDuration();
    video.addEventListener('timeupdate', syncCurrentTime);
    video.addEventListener('loadedmetadata', syncDuration);
    video.addEventListener('durationchange', syncDuration);
    video.addEventListener('emptied', resetProgress);

    return () => {
      video.removeEventListener('timeupdate', syncCurrentTime);
      video.removeEventListener('loadedmetadata', syncDuration);
      video.removeEventListener('durationchange', syncDuration);
      video.removeEventListener('emptied', resetProgress);
    };
  }, [videoRef]);

  const hasDuration = duration > 0;
  const boundedTime = hasDuration ? Math.min(currentTime, duration) : 0;
  const progressPercent = hasDuration ? (boundedTime / duration) * 100 : 0;

  return (
    <div
      className="absolute inset-x-3 bottom-10 z-20 flex h-7 items-center gap-2 rounded-full bg-slate-950/75 px-2.5 text-[10px] font-medium tabular-nums text-white shadow-md backdrop-blur-sm"
      data-testid="video-progress-control"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="min-w-7 text-right">{formatVideoTime(boundedTime)}</span>
      <div className="relative h-5 flex-1 rounded-full focus-within:ring-2 focus-within:ring-white/80">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/30">
          <div
            className="h-full rounded-full bg-cyan-300 transition-[width] duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
          style={{ left: `${progressPercent}%` }}
        />
        <input
          aria-label={ariaLabel}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          type="range"
          min={0}
          max={hasDuration ? duration : 1}
          step={0.1}
          value={boundedTime}
          disabled={!hasDuration}
          onChange={(event) => {
            const video = videoRef.current;
            const nextTime = Number(event.currentTarget.value);
            if (!video || !Number.isFinite(nextTime)) return;
            video.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
        />
      </div>
      <span className="min-w-7">{hasDuration ? formatVideoTime(duration) : '--:--'}</span>
    </div>
  );
}

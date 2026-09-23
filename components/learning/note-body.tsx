'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** Measure rendered lines so narrow layouts and explicit newlines are handled equally. */
export function NoteBody({
  text,
  zh,
  className = '',
}: {
  text: string;
  zh: boolean;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight);
      setOverflowing(node.scrollHeight > lineHeight * 4 + 1);
    };
    measure();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text]);
  return (
    <div className={className}>
      <p
        id={id}
        ref={ref}
        className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${expanded ? '' : 'line-clamp-4'}`}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 min-h-10 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? (zh ? '收起全文' : 'Collapse') : zh ? '展开全文' : 'Read more'}
        </button>
      )}
    </div>
  );
}

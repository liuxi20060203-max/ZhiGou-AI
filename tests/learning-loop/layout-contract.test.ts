import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('learning loop layout contracts', () => {
  it('renders repair outside the transformed sidebar and within the viewport', () => {
    const repair = source('components/learning-loop/repair-panel.tsx');
    expect(repair).toContain('<DialogContent');
    expect(repair).toContain('h-[min(680px,calc(100dvh-32px))]');
  });

  it('makes long component details scrollable and closes them before repair', () => {
    const sidebar = source('components/stage/knowledge-path-sidebar.tsx');
    const details = source('components/learning-loop/component-details-dialog.tsx');
    expect(sidebar).toContain('setSelectedComponentId(null);');
    expect(sidebar).toContain('<ComponentDetailsDialog');
    expect(details).toContain('h-[min(640px,calc(100dvh-32px))]');
    expect(details).toContain('overflow-y-auto overscroll-contain');
  });

  it('keeps the completion page top-reachable and collapses report details', () => {
    const completion = source('components/scene-renderers/classroom-complete.tsx');
    expect(completion).toContain('items-start justify-center overflow-y-auto');
    expect(completion.indexOf('{summary.quiz && (')).toBeLessThan(
      completion.indexOf('<KnowledgeReportCard report={knowledgeReport}'),
    );
    expect(completion).toContain('aria-expanded={expanded}');
    expect(completion).toContain('data-testid="optional-learning-review"');
    expect(completion).toContain('学习回顾（可选）');
  });
});

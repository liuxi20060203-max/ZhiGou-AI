'use client';

import { useId, useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  knowledgeCardInputSchema,
  type KnowledgeCardInput,
  type KnowledgeCardSource,
} from '@/lib/knowledge-cards/types';

export function KnowledgeCardEditor({
  initial,
  source,
  isChinese,
  onSave,
  onClose,
}: {
  initial: KnowledgeCardInput;
  source: KnowledgeCardSource;
  isChinese: boolean;
  onSave: (input: KnowledgeCardInput) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (saving) return;
    if (
      (title !== initial.title || body !== initial.body) &&
      !window.confirm(isChinese ? '放弃未保存的修改？' : 'Discard unsaved changes?')
    )
      return;
    onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = knowledgeCardInputSchema.safeParse({ title, body });
    if (!parsed.success) {
      setError(
        isChinese
          ? '请填写标题（最多120字）和正文（最多20000字）。'
          : 'A title (up to 120 characters) and body (up to 20000) are required.',
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(parsed.data);
      onClose();
    } catch {
      setError(
        isChinese
          ? '保存失败。请重试；若卡片已在别处更新，请关闭后重新打开。'
          : 'Save failed. Retry, or reopen if the card changed elsewhere.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-[min(620px,calc(100dvh-32px))] w-[min(540px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl bg-background p-0 transition-none"
      >
        <header className="shrink-0 border-b border-border/70 px-5 py-4">
          <DialogTitle>{isChinese ? '知识卡' : 'Knowledge card'}</DialogTitle>
          <p className="mt-2 text-xs text-muted-foreground">
            {isChinese
              ? '记录值得回顾的内容，保存不会改变理解状态。'
              : 'Keep something worth revisiting. Saving does not change learning status.'}
          </p>
        </header>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="break-words text-xs text-muted-foreground">
              {source.stageTitle} ·{' '}
              {source.sceneTitle ?? (isChinese ? '课程讨论' : 'Course discussion')} ·{' '}
              {source.speaker}
            </p>
            <div>
              <label htmlFor={`${id}-title`} className="text-sm font-semibold">
                {isChinese ? '标题' : 'Title'}
              </label>
              <input
                id={`${id}-title`}
                required
                maxLength={120}
                disabled={saving}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${id}-body`} className="text-sm font-semibold">
                {isChinese ? '正文' : 'Content'}
              </label>
              <textarea
                id={`${id}-body`}
                required
                maxLength={20000}
                disabled={saving}
                rows={10}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6"
              />
            </div>
          </div>
          <footer className="shrink-0 space-y-3 border-t border-border/70 px-5 py-4">
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={close}
                className="min-h-11 rounded-xl border border-border px-4 text-sm"
              >
                {isChinese ? '取消' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving
                  ? isChinese
                    ? '正在保存…'
                    : 'Saving…'
                  : isChinese
                    ? '保存知识卡'
                    : 'Save card'}
              </button>
            </div>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

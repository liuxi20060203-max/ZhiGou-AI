'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  knowledgeContentInputSchema,
  type KnowledgeContentInput,
} from '@/lib/learning-loop/authoring';
import type { KnowledgeComponent } from '@/lib/learning-loop/types';

export function KnowledgeComponentEditor({
  component,
  isChinese,
  onSave,
  onCancel,
  onSavingChange,
}: {
  component: KnowledgeComponent;
  isChinese: boolean;
  onSave: (input: KnowledgeContentInput) => Promise<void>;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const id = useId();
  const [objective, setObjective] = useState(component.objective ?? '');
  const [keyPoints, setKeyPoints] = useState(component.keyPoints.join('\n'));
  const [customQuestion, setCustomQuestion] = useState(!!component.authoredVerification);
  const [question, setQuestion] = useState(component.authoredVerification?.question ?? '');
  const [options, setOptions] = useState(component.authoredVerification?.options ?? ['', '', '']);
  const [correctIndex, setCorrectIndex] = useState(
    component.authoredVerification?.correctIndex ?? -1,
  );
  const [explanation, setExplanation] = useState(component.authoredVerification?.explanation ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fieldClass =
    'mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary/40';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = knowledgeContentInputSchema.safeParse({
      objective,
      keyPoints: keyPoints
        .split('\n')
        .map((point) => point.trim())
        .filter(Boolean),
      ...(customQuestion ? { verification: { question, options, correctIndex, explanation } } : {}),
    });
    if (!parsed.success) {
      setError(
        isChinese
          ? '请填写学习目标和 1–12 个不重复的关键点；验证题需有 2–4 个不同选项、一个正确答案及解析。'
          : 'Provide an objective and 1–12 unique key points. A question needs 2–4 distinct options, a correct answer, and an explanation.',
      );
      return;
    }
    setError('');
    setSaving(true);
    onSavingChange(true);
    try {
      await onSave(parsed.data);
    } catch {
      setError(
        isChinese
          ? '保存未成功确认，请重试；刷新前请确认保存成功。'
          : 'Save was not confirmed. Retry before refreshing.',
      );
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex min-h-0 flex-1 flex-col"
      data-testid="knowledge-component-editor"
    >
      <fieldset
        disabled={saving}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4"
      >
        <div>
          <label htmlFor={`${id}-objective`} className="text-sm font-semibold">
            {isChinese ? '学习目标' : 'Learning objective'}
          </label>
          <textarea
            id={`${id}-objective`}
            required
            maxLength={2000}
            rows={3}
            className={fieldClass}
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-points`} className="text-sm font-semibold">
            {isChinese ? '关键点' : 'Key points'}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {isChinese
              ? '每行一个，共 1–12 个，每个最多 500 字。'
              : 'One per line; 1–12 points, up to 500 characters each.'}
          </p>
          <textarea
            id={`${id}-points`}
            required
            rows={4}
            maxLength={6012}
            className={fieldClass}
            value={keyPoints}
            onChange={(event) => setKeyPoints(event.target.value)}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={customQuestion}
            onChange={(event) => setCustomQuestion(event.target.checked)}
          />
          {isChinese ? '自定义补学验证题' : 'Use a custom repair question'}
        </label>
        {customQuestion ? (
          <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-3">
            <div>
              <label htmlFor={`${id}-question`} className="text-sm font-medium">
                {isChinese ? '题目（单选）' : 'Question (single choice)'}
              </label>
              <textarea
                id={`${id}-question`}
                required
                rows={2}
                maxLength={1000}
                className={fieldClass}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isChinese
                ? '点击选项左侧圆圈指定正确答案。'
                : 'Select the circle next to the correct answer.'}
            </p>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="radio"
                  required
                  name={`${id}-correct`}
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index)}
                  aria-label={
                    isChinese ? `选项 ${index + 1} 为正确答案` : `Option ${index + 1} is correct`
                  }
                />
                <input
                  required
                  maxLength={500}
                  className={`${fieldClass} mt-0 min-w-0 flex-1`}
                  value={option}
                  aria-label={isChinese ? `选项 ${index + 1}` : `Option ${index + 1}`}
                  onChange={(event) =>
                    setOptions((values) =>
                      values.map((value, position) =>
                        position === index ? event.target.value : value,
                      ),
                    )
                  }
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="min-h-11 shrink-0 px-1 text-xs text-muted-foreground"
                    aria-label={isChinese ? `删除选项 ${index + 1}` : `Remove option ${index + 1}`}
                    onClick={() => {
                      setOptions((values) => values.filter((_, position) => position !== index));
                      setCorrectIndex((value) =>
                        value === index ? -1 : value > index ? value - 1 : value,
                      );
                    }}
                  >
                    {isChinese ? '删除' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <button
                type="button"
                className="min-h-10 text-xs font-medium text-primary"
                onClick={() => setOptions((values) => [...values, ''])}
              >
                {isChinese ? '+ 添加选项' : '+ Add option'}
              </button>
            )}
            <div>
              <label htmlFor={`${id}-explanation`} className="text-sm font-medium">
                {isChinese ? '答案解析' : 'Answer explanation'}
              </label>
              <textarea
                id={`${id}-explanation`}
                required
                rows={3}
                maxLength={2000}
                className={fieldClass}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            {isChinese
              ? '补学时会根据当前目标与关键点生成验证题。'
              : 'Repair questions will be generated from the current objective and key points.'}
          </p>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          {isChinese
            ? '修改会保存到本课程。历史学习记录继续保留，修改后需完成新版补学验证。'
            : 'Changes are saved with this course. History is preserved; the revised content requires a new repair verification.'}
        </p>
      </fieldset>
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
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-border px-4 text-sm disabled:opacity-50"
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
                ? '保存修改'
                : 'Save changes'}
          </button>
        </div>
      </footer>
    </form>
  );
}

'use client';

import { useEffect, useId, useState } from 'react';
import { NoteBody } from '@/components/learning/note-body';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  deleteKnowledgeCard,
  KNOWLEDGE_CARDS_CHANGED,
  readKnowledgeCards,
  readAllKnowledgeCards,
  saveKnowledgeCard,
} from '@/lib/knowledge-cards/storage';
import type { KnowledgeCard, KnowledgeCardSource } from '@/lib/knowledge-cards/types';
import { KnowledgeCardEditor } from './card-editor';

export function KnowledgeCardList({
  stageId,
  onOpenSource,
  sourceActionLabel,
}: {
  stageId?: string;
  onOpenSource: (source: KnowledgeCardSource) => void;
  sourceActionLabel?: string;
}) {
  const { locale } = useI18n();
  const chinese = locale === 'zh-CN';
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<KnowledgeCard>();
  const [deleting, setDeleting] = useState<string>();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const needle = query.trim().toLocaleLowerCase();
  const matches = cards.filter((card) =>
    [card.title, card.body, card.source.stageTitle, card.source.sceneTitle, card.source.speaker]
      .join('\n')
      .toLocaleLowerCase()
      .includes(needle),
  );
  useEffect(() => {
    setQuery('');
    setLimit(10);
  }, [stageId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (stageId ? readKnowledgeCards(stageId) : readAllKnowledgeCards())
      .then((items) => {
        if (!cancelled) setCards(items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stageId, refresh]);
  useEffect(() => {
    const update = (event: Event) => {
      if (!stageId || (event as CustomEvent<{ stageId: string }>).detail.stageId === stageId)
        setRefresh((value) => value + 1);
    };
    const onFocus = () => setRefresh((value) => value + 1);
    window.addEventListener(KNOWLEDGE_CARDS_CHANGED, update);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(KNOWLEDGE_CARDS_CHANGED, update);
      window.removeEventListener('focus', onFocus);
    };
  }, [stageId]);
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-testid="knowledge-card-list">
      <p className="text-xs leading-5 text-muted-foreground">
        {chinese
          ? '从问答或共思发言中保存，方便课后回顾。收藏不代表已理解。'
          : 'Saved from Q&A and discussions. Saving is not evidence of understanding.'}
      </p>
      <div>
        <label htmlFor={searchId} className="sr-only">
          {chinese ? '搜索知识卡' : 'Search knowledge cards'}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(10);
          }}
          placeholder={
            chinese ? '搜索全部知识卡、正文或课程' : 'Search all cards, content or courses'
          }
          className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
        />
      </div>
      {error ? (
        <div role="alert" className="text-xs text-destructive">
          {chinese ? '读取或删除失败，请重试。' : 'Could not load or delete cards.'}
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="ml-2 min-h-10 underline"
          >
            {chinese ? '重试' : 'Retry'}
          </button>
        </div>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">{chinese ? '正在读取…' : 'Loading…'}</p>
      ) : cards.length === 0 ? (
        <p className="rounded-xl bg-muted/40 p-4 text-xs leading-6 text-muted-foreground">
          {chinese
            ? '还没有知识卡。在「问一问」中展开已完成的回答或共思发言，点击“存为知识卡”。'
            : 'No cards yet. Open a completed answer or discussion in Ask and choose “Save as card”.'}
        </p>
      ) : matches.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">
          {chinese
            ? '没有匹配的知识卡，试试其他关键词。'
            : 'No matching cards. Try another keyword.'}
        </p>
      ) : (
        matches.slice(0, limit).map((card) => (
          <article
            key={card.sessionId}
            className="rounded-2xl border border-border/70 bg-background p-3"
          >
            <h3 className="break-words text-sm font-semibold">{card.title}</h3>
            <NoteBody text={card.body} zh={chinese} className="mt-2 text-xs leading-6" />
            <p className="mt-3 break-words text-[10px] text-muted-foreground">
              {!stageId && `${card.source.stageTitle} · `}
              {card.source.sceneTitle ?? card.source.stageTitle} · {card.source.speaker}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-primary">
              <button
                type="button"
                className="min-h-10 px-1"
                onClick={() => onOpenSource(card.source)}
              >
                {sourceActionLabel ?? (chinese ? '回到来源' : 'View source')}
              </button>
              <button type="button" className="min-h-10 px-1" onClick={() => setEditing(card)}>
                {chinese ? '编辑' : 'Edit'}
              </button>
              <button
                type="button"
                disabled={!!deleting}
                className="ml-auto min-h-10 px-1 text-muted-foreground disabled:opacity-50"
                onClick={async () => {
                  if (
                    !window.confirm(
                      chinese
                        ? '删除这张个人知识卡？原始发言会保留。'
                        : 'Delete this personal card? The original message is kept.',
                    )
                  )
                    return;
                  setDeleting(card.sessionId);
                  try {
                    await deleteKnowledgeCard(card);
                  } catch {
                    setError(true);
                  } finally {
                    setDeleting(undefined);
                  }
                }}
              >
                {deleting === card.sessionId
                  ? chinese
                    ? '删除中…'
                    : 'Deleting…'
                  : chinese
                    ? '删除'
                    : 'Delete'}
              </button>
            </div>
          </article>
        ))
      )}
      {!loading && !error && matches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span role="status">
            {chinese
              ? `已显示 ${Math.min(limit, matches.length)} / ${matches.length} 张`
              : `Showing ${Math.min(limit, matches.length)} of ${matches.length}`}
          </span>
          {limit < matches.length && (
            <button
              type="button"
              onClick={() => setLimit((value) => value + 10)}
              className="min-h-10 rounded-xl border border-border px-3 font-medium text-primary"
            >
              {chinese ? '加载更多知识卡' : 'Load more cards'}
            </button>
          )}
        </div>
      )}
      {editing && (
        <KnowledgeCardEditor
          key={editing.sessionId}
          initial={editing}
          source={editing.source}
          isChinese={chinese}
          onClose={() => setEditing(undefined)}
          onSave={(input) => saveKnowledgeCard(editing.source, input, editing)}
        />
      )}
    </div>
  );
}

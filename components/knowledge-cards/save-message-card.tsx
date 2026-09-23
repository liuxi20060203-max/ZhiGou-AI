'use client';

import { useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import { toast } from 'sonner';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { isLearningLoopEnabled } from '@/lib/config/feature-flags';
import type { ChatSession, ChatMessageMetadata } from '@/lib/types/chat';
import { knowledgeCardDraft } from '@/lib/knowledge-cards/source';
import { readKnowledgeCards, saveKnowledgeCard } from '@/lib/knowledge-cards/storage';
import { sameKnowledgeCardSource, type KnowledgeCard } from '@/lib/knowledge-cards/types';
import { KnowledgeCardEditor } from './card-editor';

export function CurrentSpeechCardAction({
  messageId,
  streaming,
}: {
  messageId?: string | null;
  streaming: boolean;
}) {
  const chats = useStageStore((state) => state.chats);
  const session = chats.find((item) => item.messages.some((message) => message.id === messageId));
  const message = session?.messages.find((item) => item.id === messageId);
  return <SaveMessageCard session={session} message={message} streaming={streaming} />;
}

export function SaveMessageCard({
  session,
  message,
  streaming,
}: {
  session?: ChatSession;
  message?: UIMessage<ChatMessageMetadata>;
  streaming: boolean;
}) {
  const stage = useStageStore((state) => state.stage);
  const scenes = useStageStore((state) => state.scenes);
  const { locale } = useI18n();
  const isChinese = locale === 'zh-CN';
  const [editing, setEditing] = useState<{
    draft: NonNullable<ReturnType<typeof knowledgeCardDraft>>;
    card?: KnowledgeCard;
  }>();
  const [loading, setLoading] = useState(false);
  const activeStage = useRef(stage?.id);
  activeStage.current = stage?.id;
  const draft = session && message ? knowledgeCardDraft(stage, scenes, session, message) : null;
  if (!isLearningLoopEnabled()) return null;
  return (
    <>
      {draft && !streaming && (
        <button
          type="button"
          disabled={loading}
          className="mt-1 block min-h-8 rounded-lg px-1 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          onClick={async () => {
            setLoading(true);
            try {
              const cards = await readKnowledgeCards(draft.source.stageId);
              if (activeStage.current === draft.source.stageId)
                setEditing({
                  draft,
                  card: cards.find((card) => sameKnowledgeCardSource(card.source, draft.source)),
                });
            } catch {
              toast.error(
                isChinese ? '暂时无法读取知识卡，请重试。' : 'Could not load cards. Please retry.',
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading
            ? isChinese
              ? '读取中…'
              : 'Loading…'
            : isChinese
              ? '存为知识卡'
              : 'Save as card'}
        </button>
      )}
      {editing && editing.draft.source.stageId === stage?.id && (
        <KnowledgeCardEditor
          initial={editing.card ?? editing.draft}
          source={editing.card?.source ?? editing.draft.source}
          isChinese={isChinese}
          onClose={() => setEditing(undefined)}
          onSave={async (input) => {
            await saveKnowledgeCard(
              editing.card?.source ?? editing.draft.source,
              input,
              editing.card,
            );
            toast.success(
              isChinese
                ? '已保存到「课堂笔记 → 知识卡」'
                : 'Saved to Class notes → Knowledge cards',
            );
          }}
        />
      )}
    </>
  );
}

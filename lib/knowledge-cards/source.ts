import type { UIMessage } from 'ai';
import type { ChatSession, ChatMessageMetadata } from '@/lib/types/chat';
import type { Stage, Scene } from '@/lib/types/stage';
import { knowledgeComponentId } from '@/lib/learning-loop/knowledge-model';
import type { KnowledgeCardSource } from './types';

export function knowledgeCardDraft(
  stage: Stage | null,
  scenes: readonly Scene[],
  session: ChatSession,
  message: UIMessage<ChatMessageMetadata>,
) {
  if (
    !stage ||
    session.type === 'lecture' ||
    message.metadata?.interrupted ||
    (session.type === 'qa' && message.role !== 'assistant')
  )
    return undefined;
  const body = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
  if (!body) return undefined;
  const scene = scenes.find((item) => item.id === session.sceneId && item.stageId === stage.id);
  const source: KnowledgeCardSource = {
    stageId: stage.id,
    stageTitle: stage.name,
    ...(session.sceneId ? { sceneId: session.sceneId } : {}),
    ...(scene
      ? { sceneTitle: scene.title, componentId: knowledgeComponentId(stage.id, scene.id) }
      : {}),
    chatSessionId: session.id,
    messageId: message.id,
    speaker: message.metadata?.senderName ?? (message.role === 'user' ? '我 / Me' : 'AI'),
    kind: session.type,
  };
  return { source, body, title: (scene?.title || session.title || body).slice(0, 120) };
}

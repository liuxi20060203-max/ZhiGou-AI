'use client';

import {
  useImperativeHandle,
  forwardRef,
  useRef,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from 'react';
import type { SessionType } from '@/lib/types/chat';
import type { DiscussionRequest } from '@/components/roundtable';
import type { Action } from '@/lib/types/action';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { buildLectureNotes } from '@/lib/chat/lecture-notes';
import { PanelRightClose, PanelRightOpen, BookOpen, MessageSquare, Sparkles } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  useChatSessions,
  MANUAL_STOP_END_OPTIONS,
  type EndSessionOptions,
  type SessionCleanupPayload,
  type ChatMessageSendOptions,
} from './use-chat-sessions';
import { SessionList } from './session-list';
import { LectureNotesView } from './lecture-notes-view';

interface ChatAreaProps {
  className?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  activeBubbleId?: string | null;
  onActiveBubble?: (messageId: string | null) => void;
  onLiveSpeech?: (text: string | null, agentId?: string | null) => void;
  onSpeechProgress?: (ratio: number | null) => void;
  onThinking?: (state: { stage: string; agentId?: string } | null) => void;
  onCueUser?: (fromAgentId?: string, prompt?: string) => void;
  onLiveSessionError?: () => void;
  onSoftCloseSession?: (payload: SessionCleanupPayload) => void;
  onSoftClosingChange?: (softClosing: boolean, deadline?: number) => void;
  onStopSession?: (payload: SessionCleanupPayload) => void;
  onSegmentSealed?: (
    messageId: string,
    partId: string,
    fullText: string,
    agentId: string | null,
  ) => void;
  /** When provided and returns true, StreamBuffer holds on the current text item after reveal. */
  shouldHoldAfterReveal?: () => { holding: boolean; segmentDone: number } | boolean;
  currentSceneId?: string | null;
  currentActionIndex?: number | null;
  canJumpToAction?: (sceneId: string, actionIndex: number) => boolean;
  onJumpToAction?: (sceneId: string, actionIndex: number) => void;
}

export interface ChatAreaRef {
  createSession: (type: SessionType, title: string) => Promise<string>;
  endSession: (sessionId: string, options?: EndSessionOptions) => Promise<void>;
  endActiveSession: (options?: EndSessionOptions) => Promise<void>;
  stopActiveSession: () => Promise<void>;
  continueActiveSoftClosingSession: () => boolean;
  softPauseActiveSession: () => Promise<void>;
  resumeActiveSession: () => Promise<void>;
  sendMessage: (content: string, options?: ChatMessageSendOptions) => Promise<void>;
  startDiscussion: (request: DiscussionRequest) => Promise<void>;
  startLecture: (sceneId: string) => Promise<string>;
  addLectureMessage: (sessionId: string, action: Action, actionIndex: number) => void;
  getIsStreaming: () => boolean;
  getActiveSessionType: () => string | null;
  getLectureMessageId: (sessionId: string) => string | null;
  pauseBuffer: (sessionId: string) => void;
  resumeBuffer: (sessionId: string) => void;
  pauseActiveLiveBuffer: () => boolean;
  resumeActiveLiveBuffer: () => void;
  switchToTab: (tab: 'lecture' | 'chat') => void;
}

const DEFAULT_WIDTH = 340;
const COLLAPSED_WIDTH = 52;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

export const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(
  (
    {
      className,
      width = DEFAULT_WIDTH,
      onWidthChange,
      collapsed = false,
      onCollapseChange,
      activeBubbleId,
      onActiveBubble,
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onLiveSessionError,
      onSoftCloseSession,
      onSoftClosingChange,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
      currentSceneId,
      currentActionIndex,
      canJumpToAction,
      onJumpToAction,
    },
    ref,
  ) => {
    const { locale } = useI18n();
    const scenes = useStageStore((s) => s.scenes);
    const [assistantThinking, setAssistantThinking] = useState(false);
    const handleAssistantThinking = useCallback(
      (state: { stage: string; agentId?: string } | null) => {
        setAssistantThinking(Boolean(state));
        onThinking?.(state);
      },
      [onThinking],
    );
    const {
      sessions,
      activeSessionType,
      expandedSessionIds,
      isStreaming,
      createSession,
      endSession,
      endActiveSession,
      continueSoftClosingSession,
      confirmSoftClosingSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      toggleSessionExpand,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
    } = useChatSessions({
      onLiveSpeech,
      onSpeechProgress,
      onThinking: handleAssistantThinking,
      onCueUser,
      onActiveBubble,
      onLiveSessionError,
      onSoftCloseSession,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
    });

    const [activeTab, setActiveTab] = useState<'lecture' | 'chat'>('lecture');
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Derive lecture notes directly from scenes — updates reactively as scenes stream in.
    const lectureNotes = useMemo(() => buildLectureNotes(scenes), [scenes]);

    // Filter out lecture sessions for the Chat tab
    const chatSessions = useMemo(() => sessions.filter((s) => s.type !== 'lecture'), [sessions]);

    // Whether there's an active discussion/QA session (for amber dot on Chat tab)
    const hasActiveChatSession = useMemo(
      () => chatSessions.some((s) => s.status === 'active'),
      [chatSessions],
    );
    const currentBlockIndex = scenes.findIndex((scene) => scene.id === currentSceneId);
    const assistantStatus = assistantThinking
      ? locale === 'zh-CN'
        ? '思考中'
        : 'Thinking'
      : isStreaming
        ? locale === 'zh-CN'
          ? '回答中'
          : 'Responding'
        : locale === 'zh-CN'
          ? '已就绪'
          : 'Ready';
    const quickPrompts =
      locale === 'zh-CN'
        ? ['换一种方式解释', '给我一个例子', '检查我是否理解', '把这段和前面的内容连起来']
        : [
            'Explain it another way',
            'Give me an example',
            'Check my understanding',
            'Connect this to what came before',
          ];

    const softClosingChatSession = useMemo(
      () => chatSessions.find((s) => s.status === 'soft-closing'),
      [chatSessions],
    );

    useEffect(() => {
      onSoftClosingChange?.(
        Boolean(softClosingChatSession),
        softClosingChatSession?.softCloseDeadline,
      );
    }, [softClosingChatSession, onSoftClosingChange]);

    // Wrap endSession for QA/Discussion: also notify parent for engine cleanup
    const handleEndSession = useCallback(
      async (sessionId: string) => {
        const session = chatSessions.find((candidate) => candidate.id === sessionId);
        if (session?.status === 'soft-closing') {
          const payload = await confirmSoftClosingSession(sessionId);
          if (payload) onStopSession?.(payload);
          return;
        }
        await endSession(sessionId, MANUAL_STOP_END_OPTIONS);
        onStopSession?.({ sessionId, source: 'manual_stop' });
      },
      [chatSessions, confirmSoftClosingSession, endSession, onStopSession],
    );

    const handleStopActiveSession = useCallback(async () => {
      const active = chatSessions.find(
        (session) => session.status === 'active' || session.status === 'soft-closing',
      );
      if (active) await handleEndSession(active.id);
    }, [chatSessions, handleEndSession]);

    const handleContinueActiveSoftClosingSession = useCallback((): boolean => {
      const softClosing = chatSessions.find((session) => session.status === 'soft-closing');
      return softClosing ? continueSoftClosingSession(softClosing.id) : false;
    }, [chatSessions, continueSoftClosingSession]);

    const switchToTab = useCallback((tab: 'lecture' | 'chat') => {
      setActiveTab(tab);
    }, []);

    const handleQuickPrompt = useCallback(
      (prompt: string) => {
        setActiveTab('chat');
        void sendMessage(prompt);
      },
      [sendMessage],
    );

    useImperativeHandle(ref, () => ({
      createSession,
      endSession,
      endActiveSession,
      stopActiveSession: handleStopActiveSession,
      continueActiveSoftClosingSession: handleContinueActiveSoftClosingSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      getIsStreaming: () => isStreaming,
      getActiveSessionType: () => activeSessionType,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
      switchToTab,
    }));

    // Drag-to-resize
    const handleDragStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (me: MouseEvent) => {
          const delta = startX - me.clientX;
          const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
          onWidthChange?.(newWidth);
        };

        const handleMouseUp = () => {
          isDraggingRef.current = false;
          setIsDragging(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [width, onWidthChange],
    );

    const displayWidth = collapsed ? COLLAPSED_WIDTH : width;

    return (
      <div
        data-testid="zhigou-assistant"
        data-collapsed={collapsed}
        data-assistant-state={assistantThinking ? 'thinking' : isStreaming ? 'responding' : 'idle'}
        style={{
          width: displayWidth,
          transition: isDragging ? 'none' : 'width 0.3s ease',
        }}
        className={cn(
          'relative z-20 flex shrink-0 flex-col overflow-visible border-l border-[color:var(--classroom-line)] bg-[color:var(--classroom-surface)]/90 shadow-[-8px_0_28px_-30px_color-mix(in_srgb,var(--classroom-ink)_42%,transparent)] backdrop-blur-xl',
          className,
        )}
      >
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute bottom-0 left-0 top-0 z-50 w-1.5 cursor-col-resize transition-colors group hover:bg-primary/20 active:bg-primary/30"
          >
            <div className="absolute left-0.5 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-gray-300 transition-colors group-hover:bg-primary dark:bg-gray-600" />
          </div>
        )}

        <div
          className={cn(
            'flex h-full w-full flex-col items-center border-l border-border/40 bg-[color:var(--classroom-surface)] py-3 transition-opacity',
            collapsed ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
          )}
        >
          <button
            type="button"
            onClick={() => onCollapseChange?.(false)}
            className="flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-primary"
            aria-label={locale === 'zh-CN' ? '展开知构助教' : 'Expand ZhiGou tutor'}
          >
            <PanelRightOpen className="size-4" />
          </button>
          <div className="mt-4 flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <span className="mt-3 [writing-mode:vertical-rl] text-[10px] font-semibold tracking-[0.16em] text-primary">
            {locale === 'zh-CN' ? '知构助教' : 'ZhiGou tutor'}
          </span>
          <span
            className={cn(
              'mt-auto size-2 rounded-full ring-4 ring-primary/10',
              isStreaming || assistantThinking ? 'animate-pulse bg-primary' : 'bg-emerald-500',
            )}
            aria-label={assistantStatus}
          />
        </div>

        <div
          style={collapsed ? { width } : undefined}
          className={cn(
            'flex h-full w-full flex-col overflow-hidden transition-opacity',
            collapsed && 'pointer-events-none invisible absolute inset-y-0 right-0 opacity-0',
          )}
        >
          <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border/60 px-4">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Sparkles className="size-5" />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background',
                  isStreaming || assistantThinking ? 'animate-pulse bg-primary' : 'bg-emerald-500',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold text-foreground"
                data-testid="assistant-title"
              >
                {locale === 'zh-CN' ? '知构助教' : 'ZhiGou tutor'}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {currentBlockIndex >= 0
                  ? locale === 'zh-CN'
                    ? `正在跟随第 ${currentBlockIndex + 1} 个知识构件 · ${assistantStatus}`
                    : `Following knowledge block ${currentBlockIndex + 1} · ${assistantStatus}`
                  : assistantStatus}
              </p>
            </div>
            {onCollapseChange && (
              <button
                type="button"
                onClick={() => onCollapseChange(true)}
                className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/75 text-muted-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-primary"
                aria-label={locale === 'zh-CN' ? '收起知构助教' : 'Collapse ZhiGou tutor'}
              >
                <PanelRightClose className="size-4" />
              </button>
            )}
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'lecture' | 'chat')}
            className="flex flex-col h-full gap-0"
          >
            {/* Tab header row */}
            <div className="mt-2 flex h-10 shrink-0 items-center gap-1 px-3">
              <div role="tablist" className="flex h-full w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'lecture'}
                  data-state={activeTab === 'lecture' ? 'active' : 'inactive'}
                  onClick={() => setActiveTab('lecture')}
                  className="flex h-full flex-1 items-center justify-center gap-1 border-0 px-2 text-xs font-medium transition-colors"
                  style={{
                    boxShadow:
                      activeTab === 'lecture' ? 'inset 0 -2px 0 var(--classroom-ink)' : 'none',
                    color:
                      activeTab === 'lecture'
                        ? 'var(--classroom-ink)'
                        : 'var(--classroom-ink-muted)',
                  }}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {locale === 'zh-CN' ? '课堂笔记' : 'Class notes'}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'chat'}
                  data-state={activeTab === 'chat' ? 'active' : 'inactive'}
                  onClick={() => setActiveTab('chat')}
                  className="relative flex h-full flex-1 items-center justify-center gap-1 border-0 px-2 text-xs font-medium transition-colors"
                  style={{
                    boxShadow:
                      activeTab === 'chat' ? 'inset 0 -2px 0 var(--classroom-ink)' : 'none',
                    color:
                      activeTab === 'chat' ? 'var(--classroom-ink)' : 'var(--classroom-ink-muted)',
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {locale === 'zh-CN' ? '问一问' : 'Ask'}
                  {/* Amber pulse dot when there's an active chat session and user is on Notes tab */}
                  {hasActiveChatSession && activeTab === 'lecture' && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Notes Tab */}
            <TabsContent value="lecture" className="flex-1 overflow-hidden flex flex-col">
              <LectureNotesView
                notes={lectureNotes}
                currentSceneId={currentSceneId}
                currentActionIndex={currentActionIndex}
                canJumpToAction={canJumpToAction}
                onJumpToAction={onJumpToAction}
              />
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 scrollbar-hide">
                {chatSessions.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-5 text-center">
                    <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Sparkles className="size-5" />
                    </div>
                    <p className="max-w-[260px] text-xs font-medium leading-5 text-foreground">
                      {locale === 'zh-CN'
                        ? '我正在跟随当前教学环节。你可以让我解释概念、举例，或检查你的理解。'
                        : 'I am following this learning block. Ask me to explain, give an example, or check your understanding.'}
                    </p>
                    <div className="mt-4 grid w-full max-w-[280px] grid-cols-2 gap-2">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          data-testid="assistant-quick-prompt"
                          onClick={() => handleQuickPrompt(prompt)}
                          disabled={isStreaming}
                          className="rounded-xl border border-border/70 bg-background/70 px-2.5 py-2 text-left text-[10px] font-medium leading-4 text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <SessionList
                      sessions={chatSessions}
                      expandedSessionIds={expandedSessionIds}
                      isStreaming={isStreaming}
                      activeBubbleId={activeBubbleId}
                      onToggleExpand={toggleSessionExpand}
                      onEndSession={handleEndSession}
                      onContinueSession={continueSoftClosingSession}
                    />
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  },
);

ChatArea.displayName = 'ChatArea';

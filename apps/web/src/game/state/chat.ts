import { skipToken } from '@reduxjs/toolkit/query/react';
import { chatMessageDeletedSchema, chatMessageSchema, chatSeatMuteSchema, type ChatMessage, type ChatView } from '@warewolf/contracts';
import { CHAT_MAX_LENGTH, chatLength, normalizeChatBody, type ChatRefusal, type GamePhase } from '@warewolf/domain';
import { useCallback, useEffect, useRef } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import {
  chatApi,
  insertMessage,
  removeMessage,
  setMuted,
  useDeleteChatMessageMutation,
  useGetChatQuery,
  usePostChatMessageMutation,
  useSetChatMuteMutation,
} from '../../api/chat';
import { useAppDispatch } from '../../app/hooks';
import { subscribePlay } from '../../realtime/session';
import { useSeat } from './lobby';

/**
 * Hooks for table chat (WW-1104, for the composer in WW-1206). Screens never
 * fetch chat or open a socket for it.
 *
 * OD-72: one public channel. Living, unmuted seats post in day discussion
 * and the ballots. The dead read only. `canPost` and `refusal` come from the
 * server, which applies the same `chatRefusal` rule as `@warewolf/domain`.
 */

export interface ChatState {
  /** Oldest first. Empty until loaded, in the lobby, and after the game ends. */
  readonly messages: readonly ChatMessage[];
  readonly mutedPlayerIds: readonly string[];
  /** Enable the composer only when this is true. */
  readonly canPost: boolean;
  /** Why the composer is disabled: `CLOSED` (night, reveal, announcement), `DEAD`, or `MUTED`. Null while loading. */
  readonly refusal: ChatRefusal | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

const EMPTY: readonly never[] = [];

/**
 * The game's chat, kept live. Pass the phase and `stateVersion` from
 * `useGameState`: a phase change or a death changes who may post, so a new
 * version reads the view again. Messages, deletions, and mutes arrive over
 * the socket. A reconnect reads the whole view again, so nothing missed while
 * offline stays on screen.
 */
export function useChat(phase: GamePhase | undefined, stateVersion: number | undefined): ChatState {
  const seat = useSeat();
  const dispatch = useAppDispatch();
  const enabled = Boolean(seat && phase && phase !== 'LOBBY');
  const gameId = enabled && seat ? seat.gameId : null;
  const token = seat?.token;
  const query = useGetChatQuery(gameId ?? skipToken);
  const { refetch } = query;

  const seen = useRef(stateVersion);
  useEffect(() => {
    if (!gameId || stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    void refetch();
  }, [gameId, stateVersion, refetch]);

  useEffect(() => {
    if (!gameId || !token) return;
    const update = (recipe: (view: ChatView) => void) => dispatch(chatApi.util.updateQueryData('getChat', gameId, recipe));
    // The seat's shared /play connection (WEB-09). It joins the rooms; chat only listens.
    return subscribePlay(token, gameId, {
      CHAT_MESSAGE_POSTED: (body) => {
        const message = chatMessageSchema.safeParse(body);
        if (message.success) update((view) => insertMessage(view, message.data));
      },
      CHAT_MESSAGE_DELETED: (body) => {
        const deleted = chatMessageDeletedSchema.safeParse(body);
        if (deleted.success) update((view) => removeMessage(view, deleted.data.messageId));
      },
      CHAT_SEAT_MUTED: (body) => {
        const muted = chatSeatMuteSchema.safeParse(body);
        if (!muted.success) return;
        update((view) => setMuted(view, muted.data.playerId, true));
        if (muted.data.playerId === seat?.playerId) void refetch();
      },
      CHAT_SEAT_UNMUTED: (body) => {
        const unmuted = chatSeatMuteSchema.safeParse(body);
        if (!unmuted.success) return;
        update((view) => setMuted(view, unmuted.data.playerId, false));
        if (unmuted.data.playerId === seat?.playerId) void refetch();
      },
      // A reconnect may have missed messages and deletions: read the whole channel again.
      connect: () => void refetch(),
    });
  }, [gameId, token, seat?.playerId, dispatch, refetch]);

  const view = gameId ? query.data : undefined;
  return {
    messages: view?.messages ?? EMPTY,
    mutedPlayerIds: view?.mutedPlayerIds ?? EMPTY,
    canPost: view?.you.canPost ?? false,
    refusal: view?.you.refusal ?? null,
    isLoading: Boolean(gameId) && query.isLoading,
    error: gameId ? apiErrorOf(query.error) : null,
    refetch: () => void refetch(),
  };
}

export interface ChatDraftCheck {
  /** Characters left, counted as the server counts them. Negative when over. */
  readonly remaining: number;
  /** False for blank text, a control character, or more than 280 characters. */
  readonly sendable: boolean;
}

/** For the composer's counter and Send button. The server checks again. */
export function checkChatDraft(text: string): ChatDraftCheck {
  const body = normalizeChatBody(text);
  const remaining = CHAT_MAX_LENGTH - chatLength(body ?? text.trim());
  return { remaining, sendable: body !== null && remaining >= 0 };
}

export interface PostChatControl {
  /** Resolves to the stored message, or null when refused. Read `error` for why. */
  readonly send: (text: string) => Promise<ChatMessage | null>;
  readonly isSending: boolean;
  /** RATE_LIMITED, CHAT_CLOSED, CHAT_READ_ONLY, CHAT_MUTED, or VALIDATION_FAILED. The message is safe to show. */
  readonly error: ApiErrorInfo | null;
}

export function usePostChat(): PostChatControl {
  const seat = useSeat();
  const [trigger, result] = usePostChatMessageMutation();
  const send = useCallback(
    async (text: string) => {
      if (!seat) return null;
      const outcome = await trigger({ gameId: seat.gameId, body: text });
      return 'data' in outcome && outcome.data ? outcome.data : null;
    },
    [seat, trigger],
  );
  return { send, isSending: result.isLoading, error: apiErrorOf(result.error) };
}

export interface ChatModerationControl {
  /** False for every seat but the host. Hide the controls when false. */
  readonly available: boolean;
  /** Each resolves to true when the server accepted it. */
  readonly deleteMessage: (messageId: string) => Promise<boolean>;
  readonly mute: (playerId: string) => Promise<boolean>;
  readonly unmute: (playerId: string) => Promise<boolean>;
  readonly isWorking: boolean;
  readonly error: ApiErrorInfo | null;
}

/** Host moderation. A non-host never sends these requests. */
export function useChatModeration(): ChatModerationControl {
  const seat = useSeat();
  const [remove, removed] = useDeleteChatMessageMutation();
  const [setMute, muted] = useSetChatMuteMutation();
  const host = seat?.isHost ? seat : null;

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!host) return false;
      return !('error' in (await remove({ gameId: host.gameId, messageId })));
    },
    [host, remove],
  );
  const toggle = useCallback(
    async (playerId: string, value: boolean) => {
      if (!host) return false;
      return !('error' in (await setMute({ gameId: host.gameId, playerId, muted: value })));
    },
    [host, setMute],
  );
  const mute = useCallback((playerId: string) => toggle(playerId, true), [toggle]);
  const unmute = useCallback((playerId: string) => toggle(playerId, false), [toggle]);

  return {
    available: host !== null,
    deleteMessage,
    mute,
    unmute,
    isWorking: removed.isLoading || muted.isLoading,
    error: apiErrorOf(removed.error ?? muted.error),
  };
}

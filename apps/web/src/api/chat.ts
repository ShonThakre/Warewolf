import { chatMessageSchema, chatViewSchema, type ChatMessage, type ChatView } from '@warewolf/contracts';
import { api } from './api';

/**
 * Table chat (WW-1104). Screens use the hooks in `src/game/state/chat.ts`.
 * One public channel per game: there is no other audience to ask for.
 */
export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Any seat in the game. The whole retained channel, oldest first. */
    getChat: build.query<ChatView, string>({
      query: (gameId) => `games/${gameId}/chat`,
      extraOptions: { schema: chatViewSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'Chat', id: gameId }],
    }),

    /**
     * Refusals: VALIDATION_FAILED (blank or over 280 characters), RATE_LIMITED,
     * CHAT_CLOSED, CHAT_READ_ONLY, CHAT_MUTED. Each message is safe to show.
     * The stored message is added to the channel without waiting for the socket.
     */
    postChatMessage: build.mutation<ChatMessage, { gameId: string; body: string }>({
      query: ({ gameId, body }) => ({ url: `games/${gameId}/chat/messages`, method: 'POST', body: { body } }),
      extraOptions: { schema: chatMessageSchema },
      async onQueryStarted({ gameId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(chatApi.util.updateQueryData('getChat', gameId, (view) => insertMessage(view, data)));
        } catch {
          // The hook reports the refusal.
        }
      },
    }),

    /** Host only. */
    deleteChatMessage: build.mutation<null, { gameId: string; messageId: string }>({
      query: ({ gameId, messageId }) => ({ url: `games/${gameId}/chat/messages/${messageId}`, method: 'DELETE' }),
      async onQueryStarted({ gameId, messageId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatApi.util.updateQueryData('getChat', gameId, (view) => removeMessage(view, messageId)));
        } catch {
          // The hook reports the refusal.
        }
      },
    }),

    /** Host only, while the game runs. The muted seat's own `you.refusal` changes, so the view is read again. */
    setChatMute: build.mutation<null, { gameId: string; playerId: string; muted: boolean }>({
      query: ({ gameId, playerId, muted }) => ({ url: `games/${gameId}/chat/mutes/${playerId}`, method: muted ? 'PUT' : 'DELETE' }),
      invalidatesTags: (_result, error, { gameId }) => (error ? [] : [{ type: 'Chat', id: gameId }]),
    }),
  }),
});

export const { useGetChatQuery, usePostChatMessageMutation, useDeleteChatMessageMutation, useSetChatMuteMutation } = chatApi;

/** Adds a message in `seq` order. A message already present (the socket and the response both deliver it) is kept once. */
export function insertMessage(view: ChatView, message: ChatMessage): void {
  if (view.messages.some((m) => m.messageId === message.messageId)) return;
  const at = view.messages.findIndex((m) => m.seq > message.seq);
  if (at === -1) view.messages.push(message);
  else view.messages.splice(at, 0, message);
}

export function removeMessage(view: ChatView, messageId: string): void {
  const at = view.messages.findIndex((m) => m.messageId === messageId);
  if (at !== -1) view.messages.splice(at, 1);
}

/** Updates the public mute list. The caller's own `you` comes from the server on the next read. */
export function setMuted(view: ChatView, playerId: string, muted: boolean): void {
  const listed = view.mutedPlayerIds.includes(playerId);
  if (muted && !listed) view.mutedPlayerIds.push(playerId);
  if (!muted && listed) view.mutedPlayerIds.splice(view.mutedPlayerIds.indexOf(playerId), 1);
}

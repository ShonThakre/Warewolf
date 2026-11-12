import { CHAT_MAX_LENGTH, CHAT_OPEN_PHASES, chatLength, normalizeChatBody } from '@warewolf/domain';
import { z } from 'zod';

/**
 * Table chat (WW-1104, OD-72). See docs/werewolf/api-design.md, section 13.
 *
 * One public channel per game. Every seat reads it; only a living, unmuted
 * seat posts, and only in day discussion and the ballots. There is no wolf
 * channel and no dead channel, so a message never carries a role or a team.
 * Messages are deleted when the game finishes or is cancelled, and the
 * results recap does not show them.
 */

export const CHAT_REFUSALS = ['CLOSED', 'DEAD', 'MUTED'] as const;

/**
 * POST /games/:gameId/chat/messages. The body is trimmed before it is
 * checked, and the stored text is the trimmed text.
 */
export const postChatMessageRequestSchema = z.strictObject({
  body: z.string().transform((raw, ctx) => {
    const body = normalizeChatBody(raw);
    if (body === null) {
      ctx.addIssue({ code: 'custom', message: 'Write a message.' });
      return z.NEVER;
    }
    if (chatLength(body) > CHAT_MAX_LENGTH) {
      ctx.addIssue({ code: 'custom', message: `Messages are at most ${CHAT_MAX_LENGTH} characters.` });
      return z.NEVER;
    }
    return body;
  }),
});
export type PostChatMessageRequest = z.input<typeof postChatMessageRequestSchema>;

/** One message. Also the payload of the `CHAT_MESSAGE_POSTED` socket event. */
export const chatMessageSchema = z.object({
  messageId: z.uuid(),
  /** Increases in posting order within a game. Gaps are normal: deleted messages leave them. */
  seq: z.number().int().positive(),
  playerId: z.uuid(),
  body: z.string(),
  roundNumber: z.number().int().positive(),
  phase: z.enum(CHAT_OPEN_PHASES),
  createdAt: z.iso.datetime(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * GET /games/:gameId/chat. Any seat in the game. The whole retained channel,
 * oldest first. A reconnecting client reads this again rather than replaying
 * socket events, so a deletion it missed is not shown.
 */
export const chatViewSchema = z.object({
  messages: z.array(chatMessageSchema),
  /** Seats the host has muted. Public: a muted seat's silence is visible at the table anyway. */
  mutedPlayerIds: z.array(z.uuid()),
  you: z.object({
    canPost: z.boolean(),
    /** Why the caller cannot post now, or null when they can. */
    refusal: z.enum(CHAT_REFUSALS).nullable(),
  }),
});
export type ChatView = z.infer<typeof chatViewSchema>;

/** Socket events on the public room of `/play`. Not stored in `game_events`, so they carry no event `seq`. */
export const CHAT_SOCKET_EVENTS = ['CHAT_MESSAGE_POSTED', 'CHAT_MESSAGE_DELETED', 'CHAT_SEAT_MUTED', 'CHAT_SEAT_UNMUTED'] as const;
export type ChatSocketEvent = (typeof CHAT_SOCKET_EVENTS)[number];

export const chatMessageDeletedSchema = z.object({ messageId: z.uuid() });
export type ChatMessageDeleted = z.infer<typeof chatMessageDeletedSchema>;

export const chatSeatMuteSchema = z.object({ playerId: z.uuid() });
export type ChatSeatMute = z.infer<typeof chatSeatMuteSchema>;

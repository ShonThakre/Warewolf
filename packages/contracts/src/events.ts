import { z } from 'zod';

/**
 * Stored game events (WW-1102). See docs/werewolf/api-design.md, sections 5 and 9.
 *
 * A response contains only rows the caller's token may see. A secret is two
 * stored rows, so this list never mixes a host fact into a player's copy.
 */

export const EVENT_AUDIENCES = ['PUBLIC', 'HOST', 'PLAYER'] as const;

export const gameEventSchema = z.object({
  seq: z.number().int().positive(),
  type: z.string(),
  audience: z.enum(EVENT_AUDIENCES),
  payload: z.record(z.string(), z.unknown()),
});
export type GameEvent = z.infer<typeof gameEventSchema>;

/** GET /games/:gameId/events?afterSeq=120 */
export const gameEventsResponseSchema = z.object({
  events: z.array(gameEventSchema),
});
export type GameEventsResponse = z.infer<typeof gameEventsResponseSchema>;

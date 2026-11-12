import { FACTIONS, LIFE_STATUSES, RESOLUTION_KINDS } from '@warewolf/domain';
import { z } from 'zod';
import { avatarIdSchema } from './lobby.js';
import { dayTallySchema } from './tally.js';

/**
 * The end of a game (WW-903a). See docs/werewolf/api-design.md, section 5,
 * "GET /games/:gameId/results".
 *
 * A finished game reveals every seat's original and final role: the recap
 * is written for the end of the game, not a widening of a private event
 * (data-model.md, section 6). A cancelled game reveals no role, so a cancel
 * is never a way to look at the deal. Chat is not part of the recap (OD-72),
 * and neither is anyone's ballot: only each ballot's public counts (OD-85).
 */

const seatSchema = z.object({
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int().positive(),
  avatarId: avatarIdSchema,
  isHost: z.boolean(),
});

export const resultSeatSchema = seatSchema.extend({
  /** What was dealt. */
  originalRoleId: z.string(),
  originalFaction: z.enum(FACTIONS),
  /** What the seat held at the end, after infection or any other conversion. */
  finalRoleId: z.string(),
  finalFaction: z.enum(FACTIONS),
  lifeStatus: z.enum(LIFE_STATUSES),
  /** Null for a survivor. */
  death: z
    .object({
      roundNumber: z.number().int().positive(),
      phaseKind: z.enum(RESOLUTION_KINDS),
      /** The role the seat held when it died. */
      roleId: z.string(),
    })
    .nullable(),
  /** On the winning team, or holding an individual win. Always false after a draw unless the seat won individually. */
  won: z.boolean(),
  /** The seat's own victory, such as the Jester voted out or a Neutral who survived (OD-73). */
  individualWin: z.boolean(),
  /** Abilities the seat used that resolved, night and day. */
  abilityUses: z.number().int().nonnegative(),
});
export type ResultSeat = z.infer<typeof resultSeatSchema>;

export const finishedResultsSchema = z.object({
  status: z.literal('FINISHED'),
  /** The round the game ended in. */
  roundNumber: z.number().int().positive(),
  /** The winning team, or null for a draw or a game won only by individuals. */
  winningTeam: z.enum(FACTIONS).nullable(),
  draw: z.boolean(),
  /** Seat order. */
  seats: z.array(resultSeatSchema),
  /** Every closed ballot's public counts (OD-85), oldest first. No voter ids. */
  tallies: z.array(dayTallySchema),
  /** Successful infections only, in order. A failed attempt was never public and stays out. */
  infections: z.array(
    z.object({
      roundNumber: z.number().int().positive(),
      sourcePlayerId: z.uuid(),
      targetPlayerId: z.uuid(),
    }),
  ),
});
export type FinishedResults = z.infer<typeof finishedResultsSchema>;

export const cancelledResultsSchema = z.object({
  status: z.literal('CANCELLED'),
  cancelReason: z.enum(['HOST', 'SURRENDER']),
  /** Seats only. No role, faction, or death. */
  seats: z.array(seatSchema),
});
export type CancelledResults = z.infer<typeof cancelledResultsSchema>;

/** GET /games/:gameId/results. Any seat in the game. 409 PHASE_CONFLICT while the game is in the lobby or running. */
export const gameResultsSchema = z.discriminatedUnion('status', [finishedResultsSchema, cancelledResultsSchema]);
export type GameResults = z.infer<typeof gameResultsSchema>;

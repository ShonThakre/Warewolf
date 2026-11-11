import { GAME_PHASES } from '@warewolf/domain';
import { z } from 'zod';

/**
 * The host's kill confirmation (WW-803, OD-01). See
 * docs/werewolf/api-design.md, "POST /games/:gameId/host/kill-target".
 *
 * Host only. The view names which wolf named which player, which only the
 * host may know (game-rules.md, section 9). It is never part of a player's
 * payload.
 */

/** The host's choice: one submitted target, or no attack tonight. */
export const killDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('TARGET'), playerId: z.uuid() }),
  z.object({ kind: z.literal('NO_KILL') }),
]);
export type KillDecision = z.infer<typeof killDecisionSchema>;

export const killCandidateSchema = z.object({
  playerId: z.uuid(),
  /** Every pack wolf who named this player, in player id order. */
  submittedBy: z.array(z.uuid()),
});
export type KillCandidate = z.infer<typeof killCandidateSchema>;

/** GET and POST /games/:gameId/host/kill-target. */
export const killTargetViewSchema = z.object({
  gameId: z.uuid(),
  phase: z.enum(GAME_PHASES),
  roundNumber: z.number().int(),
  /** The legal choices, in player id order. Empty when no wolf submitted a legal target; the host can still choose no kill. */
  candidates: z.array(killCandidateSchema),
  /** The current choice. Null until the host makes one, and the host-confirm phase cannot close until then. */
  decision: killDecisionSchema.nullable(),
  /** True during host confirm. The choice can be replaced until that phase closes. */
  editable: z.boolean(),
});
export type KillTargetView = z.infer<typeof killTargetViewSchema>;

/** One submitted player, or `{ "noKill": true }`. */
export const setKillTargetRequestSchema = z.union([z.strictObject({ targetPlayerId: z.uuid() }), z.strictObject({ noKill: z.literal(true) })]);
export type SetKillTargetRequest = z.input<typeof setKillTargetRequestSchema>;

import { z } from 'zod';

/**
 * The public vote tally (WW-904, OD-85). Published when a ballot closes:
 * weighted totals per player, abstentions, who the ballot named, and any
 * tie. Never who voted for whom; the host reads ballots on the dashboard.
 * See docs/werewolf/api-design.md, "GET /games/:gameId/tallies".
 */

export const dayTallySchema = z.object({
  roundNumber: z.number().int().positive(),
  /** 1 is the first ballot, 2 the revote. */
  ballot: z.union([z.literal(1), z.literal(2)]),
  /** Players who received votes, highest weighted total first. */
  counts: z.array(z.object({ targetPlayerId: z.uuid(), total: z.number().int().positive() })),
  abstentions: z.number().int().nonnegative(),
  /** The player the ballot named, or null for a tie or no votes. An Immortal may survive it; read life from the state. */
  votedOutPlayerId: z.uuid().nullable(),
  /** Tied leaders. On a first ballot these are the revote's only legal targets. */
  tiedPlayerIds: z.array(z.uuid()),
});
export type DayTally = z.infer<typeof dayTallySchema>;

/** GET /games/:gameId/tallies. Any seat. Closed ballots only, oldest first. */
export const dayTalliesResponseSchema = z.object({ tallies: z.array(dayTallySchema) });
export type DayTalliesResponse = z.infer<typeof dayTalliesResponseSchema>;

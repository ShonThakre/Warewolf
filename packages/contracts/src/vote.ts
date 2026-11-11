import { z } from 'zod';

/**
 * Casting a ballot (WW-901). See docs/werewolf/api-design.md, section 7.
 *
 * The response is only the caller's own vote. It never includes anyone else's.
 */

export const castVoteRequestSchema = z.strictObject({
  /** Null abstains, when the configuration allows it. */
  targetPlayerId: z.uuid().nullable(),
});

export const castVoteResponseSchema = z.object({
  /** 1 is the first ballot. 2 is the revote. */
  ballot: z.union([z.literal(1), z.literal(2)]),
  targetPlayerId: z.uuid().nullable(),
  /** The vote this one replaced, or null when it is the voter's first on this ballot. */
  supersedes: z.uuid().nullable(),
});

export type CastVoteRequest = z.infer<typeof castVoteRequestSchema>;
export type CastVoteResponse = z.infer<typeof castVoteResponseSchema>;

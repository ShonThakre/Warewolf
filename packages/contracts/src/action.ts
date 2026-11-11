import { ACTION_WINDOWS, AVAILABILITIES, GAME_PHASES, NIGHT_ACTION_STATUSES } from '@warewolf/domain';
import { z } from 'zod';

/**
 * Ability actions (Phase 6). See docs/werewolf/api-design.md, section 6.
 *
 * Privacy rule: a response names only the caller's own action and targets.
 * It never carries an outcome (an investigation result arrives as a private
 * event after resolution) or another player's action.
 */

/** Header every action submission carries. The same key and body replays the stored response. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** A UUID is ideal. Letters, digits, and `._:-`, 8 to 128 characters. */
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/, 'Send an Idempotency-Key of 8 to 128 letters, digits, or ._:- characters.');

export const actionPayloadSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

// POST /games/:gameId/actions

/**
 * Strict: a client cannot send a round, a phase, or a result. The server
 * takes those from the game.
 */
export const submitActionRequestSchema = z.strictObject({
  abilityInstanceId: z.uuid(),
  /** Empty for abilities that take no player: the informed Doctor, a Seeker reveal, the Spy, the Prophet. */
  targetPlayerIds: z.array(z.uuid()).max(4).default([]),
  /** Only the Prophet sends one: `{ "question": "WOLF_PACK_SIZE_AT_LEAST" }`. */
  payload: actionPayloadSchema.default({}),
});
export type SubmitActionRequest = z.input<typeof submitActionRequestSchema>;

export const submitActionResponseSchema = z.object({
  actionId: z.uuid(),
  status: z.enum(NIGHT_ACTION_STATUSES),
  abilityInstanceId: z.uuid(),
  roundNumber: z.number().int(),
  phase: z.enum(ACTION_WINDOWS),
  targetPlayerIds: z.array(z.uuid()),
  payload: actionPayloadSchema,
});
export type SubmitActionResponse = z.infer<typeof submitActionResponseSchema>;

// GET /games/:gameId/me/actions

/** One of the caller's own actions this round. */
export const myActionSchema = submitActionResponseSchema;
export type MyAction = SubmitActionResponse;

export const myAbilityPromptSchema = z.object({
  abilityInstanceId: z.uuid(),
  abilityId: z.string(),
  /**
   * `OPEN` means it can be submitted now. Anything else says why not:
   * PASSIVE, REVOKED, DEAD, NOT_THIS_PHASE, NOT_YET, EXPIRED, NO_USES, COOLDOWN.
   */
  availability: z.enum(AVAILABILITIES),
  /** The caller's pending or locked action for this ability this round, if any. Submitting again replaces a pending one. */
  action: myActionSchema.nullable(),
  /**
   * Only on the informed Doctor's save while it is open in the reaction
   * window (OD-02): the player the wolves will attack tonight, or null when
   * there is no attack. Absent on every other ability and in every other phase.
   */
  finalWolfTarget: z.uuid().nullable().optional(),
});
export type MyAbilityPrompt = z.infer<typeof myAbilityPromptSchema>;

/** The action panel's data: each of the caller's abilities, whether it is open now, and what they already chose. */
export const myActionsSchema = z.object({
  gameId: z.uuid(),
  phase: z.enum(GAME_PHASES),
  roundNumber: z.number().int(),
  abilities: z.array(myAbilityPromptSchema),
});
export type MyActions = z.infer<typeof myActionsSchema>;

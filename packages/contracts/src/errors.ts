import { z } from 'zod';

/**
 * Stable error codes from docs/werewolf/api-design.md. Messages sent with
 * them are generic and never carry another player's secret.
 */
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'ROOM_FULL',
  'GAME_STARTED',
  'DISPLAY_NAME_TAKEN',
  'AVATAR_TAKEN',
  'CONFIG_INVALID',
  /** Start: the number of seats taken is not the configured player count. */
  'SEAT_COUNT_MISMATCH',
  /** Start: the configuration has warnings and the request did not acknowledge them. */
  'WARNINGS_UNACKNOWLEDGED',
  'ACTION_WRONG_PHASE',
  'ACTION_DEAD',
  'ACTION_NOT_YOUR_ABILITY',
  'ACTION_NO_CHARGES',
  'ACTION_TARGET_ILLEGAL',
  'ACTION_DUPLICATE',
  'VOTE_INELIGIBLE',
  /** Chat is closed in this phase: it opens for day discussion and the ballots (OD-72). */
  'CHAT_CLOSED',
  /** The caller is dead. Dead players read the chat and never post. */
  'CHAT_READ_ONLY',
  /** The host muted the caller's seat. */
  'CHAT_MUTED',
  'NOT_HOST',
  'PHASE_CONFLICT',
  /** Host confirm cannot close until the host has chosen a target or no kill (WW-803). */
  'KILL_TARGET_REQUIRED',
  /** The host chose a player no wolf named (OD-01). */
  'KILL_TARGET_NOT_SUBMITTED',
  'IDEMPOTENCY_CONFLICT',
  'VALIDATION_FAILED',
  /** Too many requests in the window (WW-1301). */
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    /** Field problems in the caller's own request. Never another player's data. */
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

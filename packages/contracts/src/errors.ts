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
  'CONFIG_INVALID',
  'ACTION_WRONG_PHASE',
  'ACTION_DEAD',
  'ACTION_NOT_YOUR_ABILITY',
  'ACTION_NO_CHARGES',
  'ACTION_TARGET_ILLEGAL',
  'ACTION_DUPLICATE',
  'VOTE_INELIGIBLE',
  'NOT_HOST',
  'PHASE_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'VALIDATION_FAILED',
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

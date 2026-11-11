import { GAME_MODES } from '@warewolf/domain';
import { z } from 'zod';

/**
 * Public reference data. Role definitions are returned as the domain's
 * `RoleDefinition` type, which the client imports from `@warewolf/domain`;
 * they are code data, not game secrets.
 */

export const PACK_STATUSES = ['CONFIRMED', 'RECOMMENDED', 'RECONSTRUCTION', 'BLOCKED', 'TEMPLATE'] as const;

/** GET /role-packs */
export const rolePackSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(PACK_STATUSES),
  description: z.string(),
  mode: z.enum(GAME_MODES),
  playerCount: z.number().int(),
  blockedBy: z.array(z.string()),
  errorCodes: z.array(z.string()),
  warningCodes: z.array(z.string()),
});
export type RolePackSummary = z.infer<typeof rolePackSummarySchema>;

export const rolePackListSchema = z.array(rolePackSummarySchema);

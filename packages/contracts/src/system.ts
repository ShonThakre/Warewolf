import { z } from 'zod';

/** Base path for every HTTP route. */
export const API_BASE_PATH = '/api/v1';

/** GET /api/v1/health. Liveness only. It does not touch the database. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * GET /api/v1/health/ready (WW-1503). 200 when the API can reach PostgreSQL,
 * 503 when it cannot. `/health` stays the liveness check and never touches
 * the database.
 */
export const readinessResponseSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  database: z.enum(['ok', 'unavailable']),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

/** GET /api/v1/version. */
export const versionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  /** Source revision when the build provides one. */
  commit: z.string().nullable(),
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;

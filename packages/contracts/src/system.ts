import { z } from 'zod';

/** Base path for every HTTP route. */
export const API_BASE_PATH = '/api/v1';

/** GET /api/v1/health. Liveness only. It does not touch the database. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** GET /api/v1/version. */
export const versionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  /** Source revision when the build provides one. */
  commit: z.string().nullable(),
});
export type VersionResponse = z.infer<typeof versionResponseSchema>;

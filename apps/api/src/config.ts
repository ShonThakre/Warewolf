import { readFileSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().optional(),
  GIT_SHA: z.string().min(1).optional(),
  /**
   * Origins that may call the API and open `/play` from another origin, comma
   * separated, exact match (WW-1602). Empty means same origin only, which is
   * the web deployment. The Android APK's WebView is `https://localhost`, or
   * `http://localhost` in a LAN debug build.
   */
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const list = (raw ?? '').split(',').map((v) => v.trim()).filter(Boolean);
      for (const origin of list) {
        let parsed: URL | null = null;
        try {
          parsed = new URL(origin);
        } catch {
          parsed = null;
        }
        if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
          ctx.addIssue({ code: 'custom', message: `CORS_ORIGINS entry is not an origin like https://host[:port]: ${origin}` });
          return z.NEVER;
        }
      }
      return list;
    }),
});

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string | null;
  readonly name: string;
  readonly version: string;
  readonly commit: string | null;
  /** Exact origins allowed cross-origin. Empty: same origin only. */
  readonly corsOrigins: readonly string[];
}

/** Injection token for AppConfig. */
export const APP_CONFIG = Symbol('APP_CONFIG');

function readPackage(): { name: string; version: string } {
  // Resolves from both src/ (tests) and dist/ (runtime).
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  return z.object({ name: z.string(), version: z.string() }).parse(JSON.parse(raw));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const pkg = readPackage();
  return {
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL ?? null,
    name: pkg.name,
    version: pkg.version,
    commit: parsed.GIT_SHA ?? null,
    corsOrigins: parsed.CORS_ORIGINS,
  };
}

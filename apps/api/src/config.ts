import { readFileSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().optional(),
  GIT_SHA: z.string().min(1).optional(),
});

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string | null;
  readonly name: string;
  readonly version: string;
  readonly commit: string | null;
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
  };
}

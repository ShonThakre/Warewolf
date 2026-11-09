import { readFileSync } from 'node:fs';
import { GAME_MODES, GAME_PHASES, GAME_STATUSES } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';

/**
 * The CHECK constraints are generated from domain constants. If a constant
 * changes without `pnpm db:generate`, the latest migration snapshot is stale
 * and the database would reject a value the domain allows.
 */
const drizzleDir = new URL('../drizzle/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', drizzleDir), 'utf8')) as {
  entries: { idx: number; tag: string }[];
};
const latest = journal.entries.at(-1)!;
const snapshot = JSON.parse(
  readFileSync(new URL(`meta/${String(latest.idx).padStart(4, '0')}_snapshot.json`, drizzleDir), 'utf8'),
) as { tables: Record<string, { checkConstraints: Record<string, { value: string }> }> };

const checks = snapshot.tables['public.games']!.checkConstraints;
const quoted = (value: string) => [...value.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);

describe('games schema matches the domain', () => {
  it.each([
    ['games_status_ck', GAME_STATUSES],
    ['games_phase_ck', GAME_PHASES],
    ['games_mode_ck', GAME_MODES],
  ] as const)('%s lists exactly the domain values', (name, values) => {
    expect(quoted(checks[name]!.value)).toEqual([...values]);
  });

  it('every migration has a down file', () => {
    for (const entry of journal.entries) {
      expect(() => readFileSync(new URL(`down/${entry.tag}.sql`, drizzleDir))).not.toThrow();
    }
  });
});

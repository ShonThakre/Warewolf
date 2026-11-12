import { readFileSync } from 'node:fs';
import {
  ABILITY_SOURCES,
  ABILITY_STATUSES,
  ACTION_REJECTIONS,
  ACTION_WINDOWS,
  CAPABILITIES,
  CHAT_OPEN_PHASES,
  CONVERSION_REASONS,
  EFFECT_STATUSES,
  FACTIONS,
  GAME_MODES,
  GAME_PHASES,
  GAME_STATUSES,
  HANDLER_KEYS,
  INDIVIDUAL_VICTORY_STATES,
  INFECTION_FAILURES,
  NIGHT_ACTION_STATUSES,
  NIGHT_EFFECT_KINDS,
  RESOLUTION_KINDS,
  RESULT_KINDS,
} from '@warewolf/domain';
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

const checksOf = (table: string) => snapshot.tables[`public.${table}`]!.checkConstraints;
const checks = checksOf('games');
const quoted = (value: string) => [...value.matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('schema matches the domain', () => {
  it.each([
    ['games_status_ck', GAME_STATUSES],
    ['games_phase_ck', GAME_PHASES],
    ['games_mode_ck', GAME_MODES],
  ] as const)('%s lists exactly the domain values', (name, values) => {
    expect(quoted(checks[name]!.value)).toEqual([...values]);
  });

  it.each([
    ['role_assignments', 'role_assignments_original_faction_ck', FACTIONS],
    ['role_assignments', 'role_assignments_current_faction_ck', FACTIONS],
    ['role_assignments', 'role_assignments_individual_victory_ck', INDIVIDUAL_VICTORY_STATES],
    ['ability_instances', 'ability_instances_capability_ck', CAPABILITIES],
    ['ability_instances', 'ability_instances_handler_key_ck', HANDLER_KEYS],
    ['ability_instances', 'ability_instances_status_ck', ABILITY_STATUSES],
    ['ability_instances', 'ability_instances_source_ck', ABILITY_SOURCES],
    ['night_actions', 'night_actions_status_ck', NIGHT_ACTION_STATUSES],
    ['night_actions', 'night_actions_phase_ck', ACTION_WINDOWS],
    ['night_actions', 'night_actions_rejected_reason_ck', ACTION_REJECTIONS],
    ['resolution_runs', 'resolution_runs_phase_kind_ck', RESOLUTION_KINDS],
    ['elimination_records', 'elimination_records_phase_kind_ck', RESOLUTION_KINDS],
    ['elimination_records', 'elimination_records_faction_ck', FACTIONS],
    ['infection_records', 'infection_records_failure_reason_ck', INFECTION_FAILURES],
    ['investigation_records', 'investigation_records_kind_ck', RESULT_KINDS],
    ['role_conversion_records', 'role_conversion_records_reason_ck', CONVERSION_REASONS],
    ['scheduled_effects', 'scheduled_effects_kind_ck', NIGHT_EFFECT_KINDS],
    ['scheduled_effects', 'scheduled_effects_status_ck', EFFECT_STATUSES],
    ['scheduled_effects', 'scheduled_effects_due_phase_ck', RESOLUTION_KINDS],
    ['chat_messages', 'chat_messages_phase_ck', CHAT_OPEN_PHASES],
  ] as const)('%s.%s lists exactly the domain values', (table, name, values) => {
    expect(quoted(checksOf(table)[name]!.value)).toEqual([...values]);
  });

  it('every migration has a down file', () => {
    for (const entry of journal.entries) {
      expect(() => readFileSync(new URL(`down/${entry.tag}.sql`, drizzleDir))).not.toThrow();
    }
  });
});

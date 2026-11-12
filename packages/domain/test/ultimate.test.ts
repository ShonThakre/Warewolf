import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG,
  INFECTION_CORE_ROLES,
  ULTIMATE_20_ROLES,
  dealRoles,
  getPack,
  validateConfiguration,
  type GameConfiguration,
  type RoleEntry,
} from '../src/index.js';

const pack = getPack('ultimate-20')!;
const infection = getPack('infection-core')!;

function codes(config: GameConfiguration) {
  return validateConfiguration(config).errors.map((issue) => issue.code);
}

describe('Ultimate 20 roster and lock', () => {
  it('seats 20 players: 15 specials and 5 Villagers', () => {
    const seats = ULTIMATE_20_ROLES.reduce((sum, entry) => sum + entry.count, 0);
    const villagers = ULTIMATE_20_ROLES.find((entry) => entry.roleId === 'normal_villager')!.count;
    expect(seats).toBe(20);
    expect(villagers).toBe(5);
    expect(ULTIMATE_20_ROLES.filter((entry) => entry.roleId !== 'normal_villager')).toHaveLength(15);
    expect(DEFAULT_CATALOG.byId.get('vampire_servant')?.seatable).toBe(false);
  });

  it('validates with only the neutral density warning', () => {
    const result = validateConfiguration(pack.config);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    // OD-75 to OD-84 were decided on 12 November 2026, so the preset is CONFIRMED.
    expect(result.warnings.map((issue) => issue.code)).toEqual(['NEUTRAL_DENSITY']);
  });

  it('rejects each kind of edit', () => {
    const edited = (roles: readonly RoleEntry[]): GameConfiguration => ({ ...pack.config, roles });
    expect(codes(edited(ULTIMATE_20_ROLES.map((entry) => (entry.roleId === 'normal_villager' ? { ...entry, count: 4 } : entry))))).toContain('MODE_RULE_LOCKED');
    expect(codes({ ...pack.config, roles: ULTIMATE_20_ROLES.map((entry) => (entry.roleId === 'fox' ? { ...entry, faction: 'VILLAGE' } : entry)) })).toContain('MODE_RULE_LOCKED');
    expect(codes({ ...pack.config, wolves: { ...pack.config.wolves, friendlyFire: true } })).toContain('MODE_RULE_LOCKED');
    expect(codes({ ...pack.config, infection: { ...pack.config.infection, enabled: false } })).toContain('MODE_RULE_LOCKED');
    expect(codes({ ...pack.config, night: { ...pack.config.night, toggles: { ...pack.config.night.toggles, protectionBlocksPoison: true } } })).toContain('MODE_RULE_LOCKED');
  });

  it('deals the roster counts', () => {
    const players = Array.from({ length: 20 }, (_, i) => `p${i + 1}`);
    const dealt = dealRoles(pack.config, players, () => 0);
    const counts = new Map<string, number>();
    for (const card of dealt) counts.set(card.roleId, (counts.get(card.roleId) ?? 0) + 1);
    expect(counts.get('normal_villager')).toBe(5);
    expect(counts.get('alpha_wolf')).toBe(1);
    expect(dealt.find((card) => card.roleId === 'alpha_wolf')?.profileId).toBe('alpha_ultimate');
    expect(dealt.find((card) => card.roleId === 'oracle')?.profileId).toBe('oracle_alignment');
    expect(counts.size).toBe(16);
  });

  it('leaves the Infection Edition configuration unchanged', () => {
    expect(infection.config.roles).toEqual(INFECTION_CORE_ROLES);
    expect(infection.config).toMatchObject({
      mode: 'INFECTION',
      rolePackId: 'infection-core',
      teams: { wolfCap: 5, allowMultipleWinners: true },
      wolves: { knowsTeammates: false, friendlyFire: true, killAggregation: 'HOST_SELECT_AMONG_SUBMISSIONS' },
      night: { profile: 'infection-v1' },
    });
    expect(validateConfiguration(infection.config).warnings).toEqual([]);
    expect(validateConfiguration(infection.config).errors).toEqual([]);
  });
});

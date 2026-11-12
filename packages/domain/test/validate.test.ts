import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BLOCKING_DECISIONS,
  DEFAULT_PACK_BY_MODE,
  DEFAULT_PACK_ID,
  ROLE_PACKS,
  VALIDATION_ERROR_CODES,
  VALIDATION_INFO_CODES,
  VALIDATION_WARNING_CODES,
  canStart,
  getPack,
  requiredAcknowledgments,
  resolveEntry,
  SURVIVE_VICTORY,
  validateConfiguration,
  DEFAULT_CATALOG,
  type GameConfiguration,
  type RoleEntry,
  type ValidationCode,
} from '../src/index.js';

const pack = (id: string): GameConfiguration => {
  const p = getPack(id);
  if (!p) throw new Error(`missing pack ${id}`);
  return p.config;
};

const infection = pack('infection-core');
const expanded = pack('expanded-infection-20');

/** A Custom game built from role entries. Player count follows the entries unless given. */
function custom(roles: RoleEntry[], patch: Partial<GameConfiguration> = {}): GameConfiguration {
  return {
    ...pack('custom'),
    playerCount: roles.reduce((n, e) => n + e.count, 0),
    roles,
    teams: { wolfCap: roles.filter((e) => e.roleId === 'pack_wolf').reduce((n, e) => n + e.count, 0), allowMultipleWinners: true },
    ...patch,
  };
}

const classicTable = (extra: RoleEntry[] = [], villagers = 6): RoleEntry[] => [
  { roleId: 'pack_wolf', count: 2 },
  { roleId: 'seeker', count: 1 },
  { roleId: 'normal_villager', count: villagers },
  ...extra,
];

const codes = (config: GameConfiguration) => {
  const v = validateConfiguration(config);
  return [...v.errors, ...v.warnings, ...v.infos].map((i) => i.code);
};
const errorCodes = (config: GameConfiguration) => validateConfiguration(config).errors.map((e) => e.code);
const issue = (config: GameConfiguration, code: ValidationCode) => {
  const v = validateConfiguration(config);
  return [...v.errors, ...v.warnings, ...v.infos].find((i) => i.code === code);
};

/** Replace one role entry in a pack. */
const swap = (config: GameConfiguration, roleId: string, entry: RoleEntry | null): GameConfiguration => ({
  ...config,
  roles: config.roles.flatMap((e) => (e.roleId === roleId ? (entry ? [entry] : []) : [e])),
});

describe('Infection Edition default', () => {
  it('is the default pack', () => {
    expect(DEFAULT_PACK_ID).toBe('infection-core');
  });

  it('gives every mode a default pack of that mode', () => {
    for (const [mode, id] of Object.entries(DEFAULT_PACK_BY_MODE)) expect(getPack(id)?.config.mode).toBe(mode);
  });

  it('validates with no errors or warnings, and surfaces the informed Doctor', () => {
    const v = validateConfiguration(infection);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.infos.map((i) => i.code)).toEqual(['INFORMED_DOCTOR']);
    expect(canStart(v, { acknowledgeWarnings: false })).toBe(true);
  });

  it('derives the team summary instead of trusting typed counts', () => {
    expect(validateConfiguration(infection).summary).toEqual({
      playerCount: 20,
      selectedSeats: 20,
      remainingSeats: 0,
      factions: { VILLAGE: 19, WOLF_PACK: 1, NEUTRAL: 0, INDEPENDENT: 0 },
      startingPack: 1,
      wolfCap: 5,
      infectionSuccesses: 4,
    });
  });
});

describe('errors', () => {
  it('ROLE_COUNT_MISMATCH: the 5 + 13 + 3 reading is 21 seats, not 20', () => {
    const config = custom(
      [
        { roleId: 'pack_wolf', count: 5 },
        { roleId: 'normal_villager', count: 13 },
        { roleId: 'jester', count: 1 },
        { roleId: 'assassin', count: 1 },
        { roleId: 'immortal', count: 1, faction: 'VILLAGE' },
      ],
      { playerCount: 20 },
    );
    expect(errorCodes(config)).toContain('ROLE_COUNT_MISMATCH');
    expect(issue(config, 'ROLE_COUNT_MISMATCH')?.message).toBe('Roles fill 21 seats but the game has 20 players.');
  });

  it('ROLE_COUNT_MISMATCH: a negative or fractional count', () => {
    expect(errorCodes(custom(classicTable([{ roleId: 'guard', count: -1 }])))).toContain('ROLE_COUNT_MISMATCH');
    expect(errorCodes(custom(classicTable([{ roleId: 'guard', count: 0.5 }])))).toContain('ROLE_COUNT_MISMATCH');
  });

  it('PLAYER_BOUNDS: Infection Edition is exactly 20, Custom is 6 to 30', () => {
    expect(errorCodes({ ...infection, playerCount: 19 })).toContain('PLAYER_BOUNDS');
    expect(errorCodes(custom(classicTable([], 1)))).toContain('PLAYER_BOUNDS');
    expect(errorCodes(custom(classicTable([], 28)))).toContain('PLAYER_BOUNDS');
    expect(errorCodes(custom(classicTable([], 27)))).not.toContain('PLAYER_BOUNDS');
  });

  it('UNKNOWN_ROLE and UNKNOWN_PROFILE', () => {
    expect(errorCodes(custom(classicTable([{ roleId: 'not_a_role', count: 1 }])))).toContain('UNKNOWN_ROLE');
    expect(errorCodes(custom(classicTable([{ roleId: 'doctor', count: 1, abilityProfile: 'doctor_hybrid' }])))).toContain('UNKNOWN_PROFILE');
  });

  it.each([
    ['priest', 'OD-17'],
    ['hermit', 'OD-11'],
    ['confuser', 'OD-18'],
    ['bard', 'OD-20'],
  ])('ROLE_UNRESOLVED: %s is rejected and names %s', (roleId, decisionId) => {
    const config = custom(classicTable([{ roleId, count: 1 }]));
    const found = issue(config, 'ROLE_UNRESOLVED');
    expect(found?.decisionIds).toContain(decisionId);
    expect(found?.message).toContain(decisionId);
  });

  it.each([
    ['assassin', 'assassin_execute'],
    ['blacksmith', 'blacksmith_aura'],
  ])('ROLE_UNRESOLVED: the %s profile %s is rejected', (roleId, abilityProfile) => {
    const config = custom(classicTable([{ roleId, count: 1, abilityProfile }]));
    expect(issue(config, 'ROLE_UNRESOLVED')?.decisionIds).toEqual(expect.arrayContaining([roleId === 'assassin' ? 'OD-09' : 'OD-16']));
  });

  it('INFECTED_SEATED', () => {
    expect(errorCodes(custom(classicTable([{ roleId: 'infected_wolf', count: 1 }])))).toContain('INFECTED_SEATED');
  });

  it('INFECTION_WITHOUT_ALPHA and MULTIPLE_ALPHAS', () => {
    const noAlpha = swap(expanded, 'alpha_wolf', null);
    expect(errorCodes({ ...noAlpha, roles: [...noAlpha.roles, { roleId: 'normal_villager', count: 1 }] })).toContain('INFECTION_WITHOUT_ALPHA');
    const twoAlphas = swap(expanded, 'alpha_wolf', { roleId: 'alpha_wolf', count: 2 });
    expect(errorCodes(swap(twoAlphas, 'normal_villager', { roleId: 'normal_villager', count: 8 }))).toContain('MULTIPLE_ALPHAS');
  });

  it('WOLF_CAP: the starting pack cannot exceed the cap', () => {
    expect(errorCodes(custom(classicTable(), { teams: { wolfCap: 1, allowMultipleWinners: true } }))).toContain('WOLF_CAP');
  });

  it('WOLF_CAP_ABOVE_MODE: Infection Edition rejects any change, even acknowledged', () => {
    const raised = { ...infection, teams: { ...infection.teams, wolfCap: 6 } };
    expect(errorCodes(raised)).toContain('WOLF_CAP_ABOVE_MODE');
    const acked = { ...raised, rulesetAcknowledgments: { ...raised.rulesetAcknowledgments, WOLF_CAP_OVERRIDE: 'true' } };
    expect(errorCodes(acked)).toContain('WOLF_CAP_ABOVE_MODE');
    expect(errorCodes({ ...infection, infection: { ...infection.infection, maxSuccesses: 3 } })).toContain('WOLF_CAP_ABOVE_MODE');
  });

  it('WOLF_CAP_ABOVE_MODE: other modes need the override acknowledgement', () => {
    const raised = { ...expanded, teams: { ...expanded.teams, wolfCap: 7 } };
    expect(errorCodes(raised)).toContain('WOLF_CAP_ABOVE_MODE');
    const acked = { ...raised, rulesetAcknowledgments: { ...raised.rulesetAcknowledgments, WOLF_CAP_OVERRIDE: 'true' } };
    expect(errorCodes(acked)).not.toContain('WOLF_CAP_ABOVE_MODE');
  });

  it('OD-73: a team-victory role seated as Neutral wins by surviving, and does not end the game', () => {
    const shapeshifter = custom([{ roleId: 'shapeshifter', count: 1 }, { roleId: 'pack_wolf', count: 2 }, { roleId: 'normal_villager', count: 6 }]);
    expect(errorCodes(shapeshifter)).not.toContain('NEUTRAL_VICTORY_MISSING');
    expect(validateConfiguration(shapeshifter).valid).toBe(true);
    expect(resolveEntry({ roleId: 'shapeshifter', count: 1 }, DEFAULT_CATALOG)?.victory).toEqual(SURVIVE_VICTORY);
    expect(SURVIVE_VICTORY).toEqual({ type: 'INDIVIDUAL', trigger: 'ALIVE_AT_GAME_END', endGameOnWin: false, revealOnWin: false });

    const avengerNeutral = resolveEntry({ roleId: 'avenger', count: 1, faction: 'NEUTRAL' }, DEFAULT_CATALOG);
    expect(avengerNeutral?.victory).toEqual(SURVIVE_VICTORY);
    expect(resolveEntry({ roleId: 'avenger', count: 1, faction: 'VILLAGE' }, DEFAULT_CATALOG)?.victory).toEqual({ type: 'TEAM' });
    expect(errorCodes(custom(classicTable([{ roleId: 'jester', count: 1 }])))).not.toContain('NEUTRAL_VICTORY_MISSING');
  });

  it('an unresolved Neutral role is still rejected', () => {
    expect(errorCodes(custom([{ roleId: 'confuser', count: 1 }, { roleId: 'pack_wolf', count: 2 }, { roleId: 'normal_villager', count: 6 }]))).toContain('ROLE_UNRESOLVED');
  });

  it('FACTION_NOT_ALLOWED and FACTION_REQUIRED', () => {
    expect(errorCodes(custom(classicTable([{ roleId: 'jester', count: 1, faction: 'VILLAGE' }])))).toContain('FACTION_NOT_ALLOWED');
    expect(errorCodes(custom(classicTable([{ roleId: 'poisoner', count: 1 }])))).toContain('FACTION_REQUIRED');
    expect(errorCodes(custom(classicTable([{ roleId: 'poisoner', count: 1, faction: 'VILLAGE' }])))).not.toContain('FACTION_REQUIRED');
  });

  it('TEAM_TARGET_MISMATCH: typed targets are checked against derived totals', () => {
    const config = custom(classicTable(), { teams: { wolfCap: 2, allowMultipleWinners: true, targets: { VILLAGE: 8, WOLF_PACK: 2 } } });
    expect(errorCodes(config)).toContain('TEAM_TARGET_MISMATCH');
    const ok = custom(classicTable(), { teams: { wolfCap: 2, allowMultipleWinners: true, targets: { VILLAGE: 7, WOLF_PACK: 2 } } });
    expect(errorCodes(ok)).not.toContain('TEAM_TARGET_MISMATCH');
  });

  it('DOCTOR_PROFILE_MIX: the two Doctor profiles cannot be combined through overrides', () => {
    const limitedInfection = custom(classicTable([{ roleId: 'doctor', count: 1, abilityProfile: 'doctor_infection', overrides: { doctor_save: { usesPerGame: 3 } } }]));
    expect(issue(limitedInfection, 'DOCTOR_PROFILE_MIX')?.decisionIds).toEqual(['OD-02']);
    const unlimitedLimited = custom(classicTable([{ roleId: 'doctor', count: 1, abilityProfile: 'doctor_limited', overrides: { doctor_save: { usesPerGame: null } } }]));
    expect(errorCodes(unlimitedLimited)).toContain('DOCTOR_PROFILE_MIX');
    const narrowedLimited = custom(classicTable([{ roleId: 'doctor', count: 1, abilityProfile: 'doctor_limited', overrides: { doctor_save: { usesPerGame: 1 } } }]));
    expect(errorCodes(narrowedLimited)).not.toContain('DOCTOR_PROFILE_MIX');
  });

  it('DUPLICATE_ACTIVE_HEAL: two Doctors at start, whatever their profiles', () => {
    const config = custom(classicTable([
      { roleId: 'doctor', count: 1, abilityProfile: 'doctor_blind' },
      { roleId: 'doctor', count: 1, abilityProfile: 'doctor_limited' },
    ]));
    expect(errorCodes(config)).toContain('DUPLICATE_ACTIVE_HEAL');
  });

  it('ABILITY_LIMIT_INVALID', () => {
    const negative = custom(classicTable([{ roleId: 'witch', count: 1, overrides: { witch_save: { usesPerGame: -1 } } }]));
    expect(errorCodes(negative)).toContain('ABILITY_LIMIT_INVALID');
    const cooldown = custom(classicTable([{ roleId: 'seer', count: 1, overrides: { seer_investigate: { cooldownNights: -2 } } }]));
    expect(errorCodes(cooldown)).toContain('ABILITY_LIMIT_INVALID');
    const perNight = custom(classicTable([{ roleId: 'detective', count: 1, overrides: { detective_investigate: { usesPerPhase: 3 } } }]));
    expect(issue(perNight, 'ABILITY_LIMIT_INVALID')?.message).toContain('cannot exceed uses per game (2)');
  });

  it('OVERRIDE_INVALID: overrides cannot invent abilities or config', () => {
    expect(errorCodes(custom(classicTable([{ roleId: 'guard', count: 1, overrides: { guard_kill: { usesPerGame: 1 } } }])))).toContain('OVERRIDE_INVALID');
    expect(errorCodes(custom(classicTable([{ roleId: 'mayor', count: 1, overrides: { mayor_vote: { config: { veto: true } } } }])))).toContain('OVERRIDE_INVALID');
    expect(errorCodes(custom(classicTable([{ roleId: 'mayor', count: 1, overrides: { mayor_vote: { config: { weight: 'lots' } } } }])))).toContain('OVERRIDE_INVALID');
  });

  it('VOTE_WEIGHT_DOMINANT: one seat cannot carry half the table', () => {
    const config = custom(classicTable([{ roleId: 'mayor', count: 1, overrides: { mayor_vote: { config: { weight: 5 } } } }]));
    expect(errorCodes(config)).toContain('VOTE_WEIGHT_DOMINANT');
    expect(errorCodes(custom(classicTable([{ roleId: 'mayor', count: 1 }])))).not.toContain('VOTE_WEIGHT_DOMINANT');
  });

  it('NO_TERMINAL_PATH: no voting, no repeating kill, no infection', () => {
    const noKill = custom([{ roleId: 'seeker', count: 2 }, { roleId: 'normal_villager', count: 6 }], { voting: { ...pack('custom').voting, enabled: false } });
    expect(errorCodes(noKill)).toContain('NO_TERMINAL_PATH');
    const withWolves = custom(classicTable(), { voting: { ...pack('custom').voting, enabled: false } });
    expect(errorCodes(withWolves)).not.toContain('NO_TERMINAL_PATH');
  });

  it('CONTRADICTION: confirmed Guard and Doctor rules, and host adjudication', () => {
    expect(errorCodes({ ...expanded, infection: { ...expanded.infection, blockedByGuard: true } })).toContain('CONTRADICTION');
    expect(errorCodes({ ...expanded, infection: { ...expanded.infection, blockedByDoctor: true } })).toContain('CONTRADICTION');
    expect(issue({ ...expanded, allowHostAdjudication: true }, 'CONTRADICTION')?.decisionIds).toEqual(['OD-54']);
  });

  it('PACK_DEPENDENCY: Healer Assistant without a Doctor', () => {
    expect(errorCodes(custom(classicTable([{ roleId: 'healer_assistant', count: 1 }])))).toContain('PACK_DEPENDENCY');
    expect(errorCodes(custom(classicTable([{ roleId: 'healer_assistant', count: 1 }, { roleId: 'doctor', count: 1, abilityProfile: 'doctor_blind' }])))).not.toContain('PACK_DEPENDENCY');
  });

  it('PACING_TIMERS_MISSING', () => {
    expect(errorCodes({ ...pack('classic-10'), timers: null })).toContain('PACING_TIMERS_MISSING');
  });

  it('MODE_RULE_LOCKED: the Infection Edition composition and rules are fixed', () => {
    const withJester = swap(swap(infection, 'normal_villager', { roleId: 'normal_villager', count: 13 }), 'witch', { roleId: 'witch', count: 1 });
    expect(errorCodes({ ...withJester, roles: [...withJester.roles, { roleId: 'jester', count: 1 }] })).toContain('MODE_RULE_LOCKED');
    expect(errorCodes(swap(infection, 'witch', { roleId: 'witch', count: 1, overrides: { witch_save: { usesPerGame: 0 } } }))).toContain('MODE_RULE_LOCKED');
    expect(errorCodes({ ...infection, wolves: { ...infection.wolves, friendlyFire: false } })).toContain('MODE_RULE_LOCKED');
    expect(errorCodes({ ...infection, wolves: { ...infection.wolves, knowsTeammates: true } })).toContain('MODE_RULE_LOCKED');
    expect(errorCodes({ ...infection, infection: { ...infection.infection, announcement: 'PUBLIC' } })).toContain('MODE_RULE_LOCKED');
  });

  it('asserts every error and warning code somewhere in this file', () => {
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const untested = [...VALIDATION_ERROR_CODES, ...VALIDATION_WARNING_CODES, ...VALIDATION_INFO_CODES].filter(
      (code) => !source.includes(`'${code}'`),
    );
    expect(untested).toEqual([]);
  });
});

describe('blocking decisions (WW-205)', () => {
  it('lists OD-01, OD-02, and OD-03 as decided', () => {
    expect(BLOCKING_DECISIONS.map((d) => [d.id, d.decided])).toEqual([
      ['OD-01', 'HOST_SELECT_AMONG_SUBMISSIONS'],
      ['OD-02', 'INFORMED_VETO'],
      ['OD-03', 'SURVIVAL_REQUIRED'],
    ]);
  });

  it('requires all three for Infection Edition, and only OD-03 for other games with infection', () => {
    expect(requiredAcknowledgments(infection, DEFAULT_CATALOG)).toEqual({
      'OD-01': 'HOST_SELECT_AMONG_SUBMISSIONS',
      'OD-02': 'INFORMED_VETO',
      'OD-03': 'SURVIVAL_REQUIRED',
    });
    expect(requiredAcknowledgments(expanded, DEFAULT_CATALOG)).toEqual({ 'OD-03': 'SURVIVAL_REQUIRED' });
    expect(requiredAcknowledgments(pack('classic-10'), DEFAULT_CATALOG)).toEqual({});
  });

  it('rejects start when an acknowledgement is missing', () => {
    const { 'OD-02': _dropped, ...rest } = infection.rulesetAcknowledgments;
    const config = { ...infection, rulesetAcknowledgments: rest };
    expect(issue(config, 'DECISION_UNSET')?.decisionIds).toEqual(['OD-02']);
    expect(canStart(validateConfiguration(config), { acknowledgeWarnings: true })).toBe(false);
  });

  it('rejects an acknowledgement that does not match what the configuration does', () => {
    const config = { ...expanded, rulesetAcknowledgments: { 'OD-03': 'CONVERT_BEFORE_DEATH' } };
    expect(errorCodes(config)).toContain('DECISION_MISMATCH');
  });

  it('lets other modes choose another option when acknowledged', () => {
    const config = {
      ...expanded,
      infection: { ...expanded.infection, requiresSurvival: false },
      rulesetAcknowledgments: { 'OD-03': 'CONVERT_BEFORE_DEATH' },
    };
    expect(errorCodes(config)).toEqual([]);
  });

  it('holds Infection Edition to the decided values', () => {
    const majority = {
      ...infection,
      wolves: { ...infection.wolves, killAggregation: 'MAJORITY' as const },
      rulesetAcknowledgments: { ...infection.rulesetAcknowledgments, 'OD-01': 'MAJORITY' },
    };
    expect(issue(majority, 'MODE_RULE_LOCKED')?.decisionIds).toEqual(['OD-01']);
    const blindDoctor = {
      ...swap(infection, 'doctor', { roleId: 'doctor', count: 1, abilityProfile: 'doctor_infection', overrides: { doctor_save: { config: { mode: 'BLIND_TARGET' } } } }),
      rulesetAcknowledgments: { ...infection.rulesetAcknowledgments, 'OD-02': 'BLIND_TARGET' },
    };
    expect(validateConfiguration(blindDoctor).errors.map((e) => e.decisionIds?.[0])).toContain('OD-02');
  });
});

describe('warnings and start rules', () => {
  it('WOLF_RATIO_HIGH above 30 percent', () => {
    expect(codes(custom([{ roleId: 'pack_wolf', count: 4 }, { roleId: 'normal_villager', count: 6 }]))).toContain('WOLF_RATIO_HIGH');
  });

  it('WOLF_RATIO_LOW below 10 percent without infection', () => {
    expect(codes(custom([{ roleId: 'pack_wolf', count: 1 }, { roleId: 'normal_villager', count: 11 }]))).toContain('WOLF_RATIO_LOW');
    expect(codes(infection)).not.toContain('WOLF_RATIO_LOW');
  });

  it('INFECTION_CAN_REACH_PARITY when the cap is half the table', () => {
    const small = custom(
      [{ roleId: 'alpha_wolf', count: 1 }, { roleId: 'normal_villager', count: 9 }],
      { infection: expanded.infection, rulesetAcknowledgments: { 'OD-03': 'SURVIVAL_REQUIRED' }, teams: { wolfCap: 5, allowMultipleWinners: true } },
    );
    expect(codes(small)).toContain('INFECTION_CAN_REACH_PARITY');
  });

  it('VOTE_WEIGHT_HIGH at weight 3 or more, below the dominant threshold', () => {
    const config = custom(classicTable([{ roleId: 'mayor', count: 1, overrides: { mayor_vote: { config: { weight: 3 } } } }], 10));
    expect(issue(config, 'VOTE_WEIGHT_HIGH')?.decisionIds).toEqual(['OD-69']);
    expect(codes(config)).not.toContain('VOTE_WEIGHT_DOMINANT');
  });

  it('NEUTRAL_DENSITY', () => {
    const config = custom(classicTable([{ roleId: 'jester', count: 1 }, { roleId: 'assassin', count: 1 }], 4));
    expect(codes(config)).toContain('NEUTRAL_DENSITY');
  });

  it('UNCONFIRMED_PRESET names the recommended rules in use', () => {
    // Every role rule was decided on 12 November 2026, so only the reconstruction still carries this warning.
    expect(issue(pack('ultimate-20'), 'UNCONFIRMED_PRESET')).toBeUndefined();
    expect(issue(pack('classic-10'), 'UNCONFIRMED_PRESET')).toBeUndefined();
    expect(issue(expanded, 'UNCONFIRMED_PRESET')?.message).toContain('reconstruction');
  });

  it('allows start with warnings only after acknowledgement', () => {
    const v = validateConfiguration(pack('investigation-15'));
    expect(v.valid).toBe(true);
    expect(canStart(v, { acknowledgeWarnings: false })).toBe(false);
    expect(canStart(v, { acknowledgeWarnings: true })).toBe(true);
    // A confirmed preset with no warnings needs no acknowledgement.
    expect(canStart(validateConfiguration(pack('classic-10')), { acknowledgeWarnings: false })).toBe(true);
  });

  it('never allows start with errors', () => {
    expect(canStart(validateConfiguration(pack('custom')), { acknowledgeWarnings: true })).toBe(false);
  });

  it('every code has one severity', () => {
    const all = [...VALIDATION_ERROR_CODES, ...VALIDATION_WARNING_CODES, ...VALIDATION_INFO_CODES];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('resolveEntry', () => {
  it('applies overrides to the chosen profile', () => {
    const resolved = resolveEntry({ roleId: 'doctor', count: 1, abilityProfile: 'doctor_limited', overrides: { doctor_save: { usesPerGame: 1 } } }, DEFAULT_CATALOG);
    expect(resolved?.profile.id).toBe('doctor_limited');
    expect(resolved?.abilities[0]?.usesPerGame).toBe(1);
    expect(resolved?.faction).toBe('VILLAGE');
  });

  it('returns null for an entry the validator would reject', () => {
    expect(resolveEntry({ roleId: 'not_a_role', count: 1 }, DEFAULT_CATALOG)).toBeNull();
    expect(resolveEntry({ roleId: 'mayor', count: 1, overrides: { mayor_vote: { config: { veto: true } } } }, DEFAULT_CATALOG)).toBeNull();
  });
});

describe('packs (WW-204)', () => {
  const expected: Record<string, { status: string; players: number; errors: string[]; warnings: string[] }> = {
    'infection-core': { status: 'CONFIRMED', players: 20, errors: [], warnings: [] },
    'classic-10': { status: 'CONFIRMED', players: 10, errors: [], warnings: [] },
    'expanded-infection-20': { status: 'RECONSTRUCTION', players: 20, errors: [], warnings: ['UNCONFIRMED_PRESET'] },
    'investigation-15': { status: 'CONFIRMED', players: 15, errors: [], warnings: ['INFO_ROLE_DENSITY'] },
    'protection-15': { status: 'CONFIRMED', players: 15, errors: [], warnings: ['PROTECTION_DENSITY'] },
    'chaos-15': { status: 'CONFIRMED', players: 15, errors: [], warnings: ['NEUTRAL_DENSITY'] },
    'expanded-24': { status: 'CONFIRMED', players: 24, errors: [], warnings: [] },
    'expanded-30': { status: 'CONFIRMED', players: 30, errors: [], warnings: ['INFO_ROLE_DENSITY'] },
    'ultimate-20': { status: 'CONFIRMED', players: 20, errors: [], warnings: ['NEUTRAL_DENSITY'] },
    custom: { status: 'TEMPLATE', players: 10, errors: ['ROLE_COUNT_MISMATCH'], warnings: ['WOLF_RATIO_LOW'] },
  };

  it('covers every pack', () => {
    expect(ROLE_PACKS.map((p) => p.id).sort()).toEqual(Object.keys(expected).sort());
  });

  it.each(ROLE_PACKS.map((p) => [p.id, p] as const))('%s validates as documented', (id, p) => {
    const want = expected[id]!;
    const v = validateConfiguration(p.config);
    expect(p.status).toBe(want.status);
    expect(p.config.playerCount).toBe(want.players);
    expect(p.config.rolePackId).toBe(id);
    expect(v.errors.map((e) => e.code)).toEqual(want.errors);
    expect(v.warnings.map((w) => w.code)).toEqual(want.warnings);
  });

  it('every shippable pack sums to its player count', () => {
    for (const p of ROLE_PACKS.filter((x) => x.status !== 'TEMPLATE')) {
      expect(p.config.roles.reduce((n, e) => n + e.count, 0), p.id).toBe(p.config.playerCount);
    }
  });

  it('no shippable pack seats an unresolved role or profile', () => {
    for (const p of ROLE_PACKS) {
      expect(codes(p.config), p.id).not.toContain('ROLE_UNRESOLVED');
    }
  });

  it('chaos-15 is seatable and its Neutral Shapeshifter survives to win', () => {
    const chaos = getPack('chaos-15')!;
    expect(chaos.blockedBy).toEqual([]);
    expect(chaos.config.roles.reduce((n, entry) => n + entry.count, 0)).toBe(15);
    const result = validateConfiguration(chaos.config);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(resolveEntry(chaos.config.roles.find((entry) => entry.roleId === 'shapeshifter')!, DEFAULT_CATALOG)?.victory).toEqual(SURVIVE_VICTORY);
  });

  it('pack data is frozen', () => {
    expect(Object.isFrozen(getPack('infection-core')!.config.roles)).toBe(true);
  });
});

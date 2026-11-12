import { deepFreeze } from '../util/canonical.js';
import type { GameMode } from '../game.js';
import type { GameConfiguration, RoleEntry } from './types.js';

/**
 * Role packs are configuration documents. They run through the same validator
 * as a custom draft. See docs/werewolf/role-configuration.md, sections 3 to 9.
 *
 * Status:
 * - CONFIRMED: composition and rules come from the brief.
 * - RECOMMENDED: uses recommended role profiles. Startable after the host acknowledges the warning.
 * - RECONSTRUCTION: a validated stand-in for a setup the brief describes inconsistently.
 * - BLOCKED: does not validate until the listed decisions are made.
 * - TEMPLATE: an empty starting point for Custom games.
 */
export type PackStatus = 'CONFIRMED' | 'RECOMMENDED' | 'RECONSTRUCTION' | 'BLOCKED' | 'TEMPLATE';

export interface RolePack {
  readonly id: string;
  readonly name: string;
  readonly status: PackStatus;
  readonly description: string;
  /** Decisions that must be made before a BLOCKED pack can start. */
  readonly blockedBy: readonly string[];
  readonly config: GameConfiguration;
}

const NO_TOGGLES = {
  protectionBlocksPoison: false,
  bodyguardRedirectsPoison: false,
  copyInformedDoctor: false,
  informBlockedPlayer: false,
  trackerIncludesActionType: false,
} as const;

const VOTING: GameConfiguration['voting'] = {
  enabled: true,
  abstain: true,
  changeUntilClose: true,
  deadMayVote: false,
  tie: 'REVOTE_THEN_NONE',
  revealOnDayElimination: 'CURRENT_ROLE',
  revealOnNightDeath: 'CURRENT_ROLE',
};

const INFECTION_ON: GameConfiguration['infection'] = {
  enabled: true,
  maxSuccesses: 4,
  attemptsPerNight: 1,
  eligibility: 'VILLAGE_ONLY',
  requiresSurvival: true,
  announcement: 'SILENT',
  blockedByGuard: false,
  blockedByDoctor: false,
  alphaDeath: 'SEAL',
  grantKillNextNight: true,
};

const INFECTION_OFF: GameConfiguration['infection'] = { ...INFECTION_ON, enabled: false };

/** Classic timers from OD-43. */
const CLASSIC_TIMERS = { nightSeconds: 90, daySeconds: 180, voteSeconds: 60 } as const;

function base(input: Pick<GameConfiguration, 'mode' | 'rolePackId' | 'roles'> & Partial<GameConfiguration>): GameConfiguration {
  const playerCount = input.roles.reduce((n, e) => n + e.count, 0);
  return {
    version: 1,
    playerCount,
    pacing: 'HOST',
    timers: null,
    roundCap: 20,
    rulesetAcknowledgments: {},
    teams: { wolfCap: 0, allowMultipleWinners: true },
    wolves: { knowsTeammates: true, friendlyFire: false, killAggregation: 'MAJORITY' },
    infection: INFECTION_OFF,
    voting: VOTING,
    night: { profile: 'custom-v1', toggles: NO_TOGGLES },
    allowHostAdjudication: false,
    ...input,
  };
}

const r = (roleId: string, count: number, extra: Omit<RoleEntry, 'roleId' | 'count'> = {}): RoleEntry => ({ roleId, count, ...extra });

/** Pack 1. Also the fixed composition the validator enforces for Infection Edition. */
export const INFECTION_CORE_ROLES: readonly RoleEntry[] = [
  r('alpha_wolf', 1),
  r('seeker', 2),
  r('guard', 1),
  r('doctor', 1, { abilityProfile: 'doctor_infection' }),
  r('witch', 1),
  r('normal_villager', 14),
];

/**
 * Ultimate 20's fixed roster. Profiles and factions are part of the lock.
 * Engineering defaults are documented in docs/werewolf/ultimate-20-rules.md.
 */
export const ULTIMATE_20_ROLES: readonly RoleEntry[] = [
  r('alpha_wolf', 1, { abilityProfile: 'alpha_ultimate' }),
  r('shadow_wolf', 1),
  r('vampire', 1),
  r('joker', 1),
  r('time_wizard', 1),
  r('oracle', 1, { abilityProfile: 'oracle_alignment' }),
  r('guardian', 1),
  r('alchemist', 1),
  r('fox', 1),
  r('mimic', 1),
  r('ghost', 1),
  r('mind_controller', 1),
  r('necromancer', 1),
  r('double_agent', 1),
  r('chaos_demon', 1),
  r('normal_villager', 5),
];

const packs: RolePack[] = [
  {
    id: 'infection-core',
    name: 'Infection Edition',
    status: 'CONFIRMED',
    description: 'The default 20-player game. One hidden Alpha Wolf grows the pack by infection.',
    blockedBy: [],
    config: base({
      mode: 'INFECTION',
      rolePackId: 'infection-core',
      roles: INFECTION_CORE_ROLES,
      rulesetAcknowledgments: { 'OD-01': 'HOST_SELECT_AMONG_SUBMISSIONS', 'OD-02': 'INFORMED_VETO', 'OD-03': 'SURVIVAL_REQUIRED' },
      teams: { wolfCap: 5, allowMultipleWinners: true },
      wolves: { knowsTeammates: false, friendlyFire: true, killAggregation: 'HOST_SELECT_AMONG_SUBMISSIONS' },
      infection: INFECTION_ON,
      night: { profile: 'infection-v1', toggles: NO_TOGGLES },
    }),
  },
  {
    id: 'classic-10',
    name: 'Classic',
    status: 'CONFIRMED',
    description: 'A short beginner game. Two Pack Wolves who know each other, no infection, no neutrals.',
    blockedBy: [],
    config: base({
      mode: 'CLASSIC',
      rolePackId: 'classic-10',
      roles: [r('pack_wolf', 2), r('seeker', 1), r('doctor', 1, { abilityProfile: 'doctor_blind' }), r('normal_villager', 6)],
      pacing: 'TIMED',
      timers: CLASSIC_TIMERS,
      teams: { wolfCap: 2, allowMultipleWinners: true },
      night: { profile: 'classic-v1', toggles: NO_TOGGLES },
    }),
  },
  {
    id: 'expanded-infection-20',
    name: 'Balanced Expanded (reconstruction)',
    status: 'RECONSTRUCTION',
    description: 'Pack 2A. Infection plus extra powers and two neutrals. Rebuilt from an inconsistent brief for playtesting.',
    blockedBy: [],
    config: base({
      mode: 'EXPANDED',
      rolePackId: 'expanded-infection-20',
      roles: [
        r('alpha_wolf', 1),
        r('seeker', 1),
        r('guard', 1),
        r('doctor', 1, { abilityProfile: 'doctor_limited' }),
        r('witch', 1),
        r('blacksmith', 1, { abilityProfile: 'blacksmith_item' }),
        r('detective', 1),
        r('bodyguard', 1),
        r('cursed_villager', 1),
        r('jester', 1),
        r('assassin', 1, { abilityProfile: 'assassin_mark' }),
        r('normal_villager', 9),
      ],
      rulesetAcknowledgments: { 'OD-03': 'SURVIVAL_REQUIRED' },
      teams: { wolfCap: 5, allowMultipleWinners: true },
      wolves: { knowsTeammates: false, friendlyFire: false, killAggregation: 'HOST_SELECT_AMONG_SUBMISSIONS' },
      infection: INFECTION_ON,
    }),
  },
  {
    id: 'investigation-15',
    name: 'Investigation Edition',
    status: 'CONFIRMED',
    description: 'Three Pack Wolves against a village full of investigators.',
    blockedBy: [],
    config: base({
      mode: 'EXPANDED',
      rolePackId: 'investigation-15',
      roles: [
        r('pack_wolf', 3),
        r('seeker', 1),
        r('detective', 1),
        r('oracle', 1),
        r('tracker', 1),
        r('psychic', 1),
        r('medium', 1),
        r('prophet', 1),
        r('seer', 1),
        r('normal_villager', 4),
      ],
      teams: { wolfCap: 3, allowMultipleWinners: true },
    }),
  },
  {
    id: 'protection-15',
    name: 'Protection Edition',
    status: 'CONFIRMED',
    description: 'Three Pack Wolves against a heavily protected village.',
    blockedBy: [],
    config: base({
      mode: 'EXPANDED',
      rolePackId: 'protection-15',
      roles: [
        r('pack_wolf', 3),
        r('doctor', 1, { abilityProfile: 'doctor_limited' }),
        r('guard', 1),
        r('bodyguard', 1),
        r('shieldbearer', 1),
        r('trapper', 1),
        r('blacksmith', 1, { abilityProfile: 'blacksmith_item' }),
        r('healer_assistant', 1),
        r('normal_villager', 5),
      ],
      teams: { wolfCap: 3, allowMultipleWinners: true },
    }),
  },
  {
    id: 'chaos-15',
    name: 'Chaos',
    status: 'CONFIRMED',
    description: 'Several ways to win. A Neutral role without its own victory wins by surviving to the end.',
    blockedBy: [],
    config: base({
      mode: 'EXPANDED',
      rolePackId: 'chaos-15',
      roles: [
        r('pack_wolf', 2),
        r('jester', 1),
        r('assassin', 1, { abilityProfile: 'assassin_mark' }),
        r('cursed_villager', 1),
        r('shapeshifter', 1, { faction: 'NEUTRAL' }),
        r('spy', 1),
        r('lone_wolf', 1),
        r('avenger', 1),
        r('normal_villager', 6),
      ],
      // Starting pack plus room for the Cursed Villager's conversion.
      teams: { wolfCap: 3, allowMultipleWinners: true },
    }),
  },
  {
    id: 'expanded-24',
    name: 'Expanded 24',
    status: 'CONFIRMED',
    description: 'A proposal for a 24-player playtest.',
    blockedBy: [],
    config: base({
      mode: 'EXPANDED',
      rolePackId: 'expanded-24',
      roles: [
        r('pack_wolf', 5),
        r('seeker', 2),
        r('detective', 1),
        r('doctor', 1, { abilityProfile: 'doctor_limited' }),
        r('guard', 1),
        r('witch', 1),
        r('bodyguard', 1),
        r('blacksmith', 1, { abilityProfile: 'blacksmith_item' }),
        r('jester', 1),
        r('assassin', 1, { abilityProfile: 'assassin_mark' }),
        r('normal_villager', 9),
      ],
      teams: { wolfCap: 5, allowMultipleWinners: true },
    }),
  },
  {
    id: 'expanded-30',
    name: 'Expanded 30',
    status: 'CONFIRMED',
    description: 'A proposal for a 30-player playtest with three non-village ways to win.',
    blockedBy: [],
    config: base({
      mode: 'EXPANDED',
      rolePackId: 'expanded-30',
      roles: [
        r('pack_wolf', 7),
        r('seeker', 2),
        r('detective', 1),
        r('oracle', 1),
        r('doctor', 1, { abilityProfile: 'doctor_limited' }),
        r('guard', 1),
        r('witch', 1),
        r('bodyguard', 1),
        r('trapper', 1),
        r('jester', 1),
        r('assassin', 1, { abilityProfile: 'assassin_mark' }),
        r('lone_wolf', 1),
        r('normal_villager', 11),
      ],
      teams: { wolfCap: 7, allowMultipleWinners: true },
    }),
  },
  {
    id: 'ultimate-20',
    name: 'Ultimate 20',
    status: 'CONFIRMED',
    description: 'Twenty seats: fifteen special roles and five Villagers. Infection stays on.',
    blockedBy: [],
    config: base({
      mode: 'ULTIMATE_20',
      rolePackId: 'ultimate-20',
      roles: ULTIMATE_20_ROLES,
      rulesetAcknowledgments: { 'OD-03': 'SURVIVAL_REQUIRED' },
      teams: { wolfCap: 5, allowMultipleWinners: true },
      wolves: { knowsTeammates: false, friendlyFire: false, killAggregation: 'ALPHA_PRIORITY' },
      infection: INFECTION_ON,
      night: { profile: 'ultimate-v1', toggles: NO_TOGGLES },
    }),
  },
  {
    id: 'custom',
    name: 'Custom',
    status: 'TEMPLATE',
    description: 'No seats yet. Add catalog roles until validation passes.',
    blockedBy: [],
    config: base({ mode: 'CUSTOM', rolePackId: 'custom', roles: [], playerCount: 10 }),
  },
];

export const ROLE_PACKS: readonly RolePack[] = deepFreeze(packs);

export const PACK_STATUS: Readonly<Record<string, PackStatus>> = Object.fromEntries(ROLE_PACKS.map((p) => [p.id, p.status]));

export function getPack(id: string): RolePack | undefined {
  return ROLE_PACKS.find((p) => p.id === id);
}

/** The pack a new game starts with when the host does not choose one. */
export const DEFAULT_PACK_ID = 'infection-core';

/** The pack a new room of each mode starts from. The host can switch packs in the lobby. */
export const DEFAULT_PACK_BY_MODE: Readonly<Record<GameMode, string>> = {
  INFECTION: 'infection-core',
  CLASSIC: 'classic-10',
  EXPANDED: 'expanded-infection-20',
  CUSTOM: 'custom',
  ULTIMATE_20: 'ultimate-20',
};

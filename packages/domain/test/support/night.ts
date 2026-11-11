import {
  DEFAULT_CATALOG,
  getPack,
  isWolfAligned,
  resolveEntry,
  resolveNight,
  type AbilityOverride,
  type Faction,
  type GameConfiguration,
  type HostKillDecision,
  type NightAbility,
  type NightAction,
  type NightAssignment,
  type NightInput,
  type NightPlayer,
  type NightResult,
  type UsePatch,
} from '../../src/index.js';

/** Shared builders for the night resolver tests. Seat ids double as player ids, and ability instance ids are `seat:abilityId`. */

export const infectionConfig = getPack('infection-core')!.config;
export const classicConfig = getPack('classic-10')!.config;

export interface Seat {
  readonly id: string;
  readonly roleId: string;
  readonly profileId?: string;
  readonly faction?: Faction;
  readonly overrides?: Readonly<Record<string, AbilityOverride>>;
}

/** Infection Edition's 20 seats with readable ids. */
export const INFECTION_SEATS: Seat[] = [
  { id: 'alpha', roleId: 'alpha_wolf' },
  { id: 'seeker1', roleId: 'seeker' },
  { id: 'seeker2', roleId: 'seeker' },
  { id: 'guard', roleId: 'guard' },
  { id: 'doctor', roleId: 'doctor', profileId: 'doctor_infection' },
  { id: 'witch', roleId: 'witch' },
  ...Array.from({ length: 14 }, (_, i) => ({ id: `v${i + 1}`, roleId: 'normal_villager' })),
];

export const CLASSIC_SEATS: Seat[] = [
  { id: 'wolf1', roleId: 'pack_wolf' },
  { id: 'wolf2', roleId: 'pack_wolf' },
  { id: 'seeker1', roleId: 'seeker' },
  { id: 'doctor', roleId: 'doctor', profileId: 'doctor_blind' },
  ...Array.from({ length: 6 }, (_, i) => ({ id: `v${i + 1}`, roleId: 'normal_villager' })),
];

/** Two pack wolves, then one of every role an expanded night resolves, then villagers. Classic rules (majority). */
export const EXPANDED_SEATS: Seat[] = [
  { id: 'wolf1', roleId: 'pack_wolf' },
  { id: 'wolf2', roleId: 'pack_wolf' },
  { id: 'lone', roleId: 'lone_wolf' },
  { id: 'guard', roleId: 'guard' },
  { id: 'bodyguard', roleId: 'bodyguard' },
  { id: 'trapper', roleId: 'trapper' },
  { id: 'smith', roleId: 'blacksmith', profileId: 'blacksmith_item' },
  { id: 'doctor', roleId: 'doctor', profileId: 'doctor_limited' },
  { id: 'assistant', roleId: 'healer_assistant' },
  { id: 'witch', roleId: 'witch' },
  { id: 'immortal', roleId: 'immortal' },
  { id: 'avenger', roleId: 'avenger' },
  { id: 'cursed', roleId: 'cursed_villager' },
  { id: 'disruptor', roleId: 'disruptor', faction: 'NEUTRAL' },
  { id: 'poisoner', roleId: 'poisoner', faction: 'NEUTRAL' },
  { id: 'shifter', roleId: 'shapeshifter' },
  { id: 'assassin', roleId: 'assassin', profileId: 'assassin_mark' },
  { id: 'detective', roleId: 'detective' },
  { id: 'oracle', roleId: 'oracle' },
  { id: 'tracker', roleId: 'tracker' },
  { id: 'psychic', roleId: 'psychic' },
  { id: 'medium', roleId: 'medium' },
  { id: 'prophet', roleId: 'prophet' },
  { id: 'seer', roleId: 'seer' },
  { id: 'spy', roleId: 'spy' },
  { id: 'jester', roleId: 'jester' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `v${i + 1}`, roleId: 'normal_villager' })),
];

export interface Table {
  readonly players: NightPlayer[];
  readonly assignments: NightAssignment[];
  readonly abilities: NightAbility[];
}

export function table(seats: readonly Seat[], changes: { dead?: string[]; wolves?: string[] } = {}): Table {
  const abilities: NightAbility[] = [];
  const assignments: NightAssignment[] = seats.map((seat) => {
    const entry = resolveEntry(
      {
        roleId: seat.roleId,
        count: 1,
        ...(seat.profileId ? { abilityProfile: seat.profileId } : {}),
        ...(seat.faction ? { faction: seat.faction } : {}),
        ...(seat.overrides ? { overrides: seat.overrides } : {}),
      },
      DEFAULT_CATALOG,
    )!;
    for (const def of entry.abilities) {
      abilities.push({
        id: `${seat.id}:${def.id}`,
        playerId: seat.id,
        status: 'ACTIVE',
        chargesRemaining: def.usesPerGame,
        usesConsumed: 0,
        lastUsedRound: null,
        lastTargetPlayerId: null,
        availableFromRound: def.availableFromRound,
        expiresRound: null,
        config: def,
      });
    }
    const wolf = changes.wolves?.includes(seat.id);
    return {
      playerId: seat.id,
      currentRoleId: wolf ? 'infected_wolf' : seat.roleId,
      currentProfileId: wolf ? 'infected_wolf' : entry.profile.id,
      currentFaction: wolf ? 'WOLF_PACK' : entry.faction,
      wolfAligned: wolf ? true : isWolfAligned(entry.role, entry.faction),
      individualVictory: 'NONE',
    };
  });
  for (const wolf of changes.wolves ?? []) {
    const def = DEFAULT_CATALOG.byId.get('infected_wolf')!.profiles['infected_wolf']!.abilities[0]!;
    abilities.push({ id: `${wolf}:${def.id}`, playerId: wolf, status: 'ACTIVE', chargesRemaining: null, usesConsumed: 0, lastUsedRound: null, lastTargetPlayerId: null, availableFromRound: 1, expiresRound: null, config: def });
  }
  const players = seats.map((s) => ({ id: s.id, lifeStatus: changes.dead?.includes(s.id) ? ('DEAD' as const) : ('ALIVE' as const) }));
  return { players, assignments, abilities };
}

/** Changes one ability row, such as spending its charges. */
export function withAbility(t: Table, abilityInstanceId: string, change: Partial<NightAbility>): Table {
  return { ...t, abilities: t.abilities.map((a) => (a.id === abilityInstanceId ? { ...a, ...change } : a)) };
}

let actionCounter = 0;
/** An action by `playerId` with their ability `abilityId`. Ids sort in creation order. */
export function act(playerId: string, abilityId: string, targets: string[] = [], phase: NightAction['phase'] = 'NIGHT_SUBMIT', payload: NightAction['payload'] = {}): NightAction {
  actionCounter++;
  return { id: `a${String(actionCounter).padStart(3, '0')}`, playerId, abilityInstanceId: `${playerId}:${abilityId}`, phase, targetPlayerIds: targets, payload };
}

export function night(t: Table, actions: NightAction[], extra: Partial<NightInput> & { config?: GameConfiguration } = {}): NightResult {
  return resolveNight({
    round: 1,
    config: infectionConfig,
    ...t,
    actions,
    hostDecision: null,
    infection: { successes: 0, sealed: false },
    ...extra,
  });
}

export const target = (playerId: string): HostKillDecision => ({ kind: 'TARGET', playerId });
export const deaths = (r: NightResult) => r.deaths.map((d) => d.playerId);
export const statusOf = (r: NightResult, actionId: string) => r.actions.find((a) => a.actionId === actionId);
export const update = (r: NightResult, abilityInstanceId: string) => r.abilityUpdates.find((u) => u.abilityInstanceId === abilityInstanceId)?.patch;

/** The patch one resolved use writes on an unlimited ability in round 1. */
export function used(lastTargetPlayerId: string | null, extra: Partial<UsePatch> = {}): UsePatch {
  return { chargesRemaining: null, usesConsumed: 1, lastUsedRound: 1, lastTargetPlayerId, status: 'ACTIVE', ...extra };
}

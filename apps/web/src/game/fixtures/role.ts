import type { HostRoster, MyRole, OwnAbility, Teammate } from '@warewolf/contracts';
import { DEFAULT_CATALOG, dealRoles, getPack, type Faction } from '@warewolf/domain';

/**
 * Role projections for screens, stories, and tests (WW-404a). Built from the
 * real catalog so they match what GET /me and GET /host/roster return. Ids
 * are fixed so snapshots stay stable.
 */

export const FIXTURE_GAME_ID = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';

/** A valid, stable v4-shaped UUID for fixture `n`. */
export const fixtureId = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

export const fixturePlayerId = (seat: number) => fixtureId(seat);

const NAMES = [
  'Asha', 'Rafi', 'Mira', 'Tomas', 'Ines', 'Kofi', 'Lena', 'Yusuf', 'Noor', 'Pavel',
  'Sana', 'Diego', 'Hana', 'Oskar', 'Priya', 'Felix', 'Zara', 'Emil', 'Ayla', 'Bruno',
];
export const fixtureName = (seat: number) => NAMES[(seat - 1) % NAMES.length]!;

function profileOf(roleId: string, profileId?: string) {
  const role = DEFAULT_CATALOG.byId.get(roleId);
  const profile = role?.profiles[profileId ?? role.defaultProfileId];
  if (!role || !profile) throw new Error(`fixture: unknown role ${roleId}/${profileId ?? '(default)'}`);
  return { role, profile };
}

export interface OwnRoleFixtureOptions {
  readonly seat?: number;
  readonly profileId?: string;
  readonly faction?: Faction;
  /** A conversion: the player now holds this role, and its abilities. */
  readonly current?: { readonly roleId: string; readonly profileId?: string; readonly faction?: Faction };
  readonly teammatesVisible?: boolean;
  readonly teammates?: readonly Teammate[];
  /** Per-ability changes, such as a spent potion. */
  readonly abilities?: Readonly<Record<string, Partial<OwnAbility>>>;
}

/** The GET /me projection for one seat holding `roleId`. */
export function ownRoleFixture(roleId: string, options: OwnRoleFixtureOptions = {}): MyRole {
  const seat = options.seat ?? 1;
  const original = profileOf(roleId, options.profileId);
  const currentId = options.current?.roleId ?? roleId;
  const current = options.current ? profileOf(currentId, options.current.profileId) : original;
  const originalFaction = options.faction ?? original.role.defaultFaction;
  const currentFaction = options.current ? (options.current.faction ?? current.role.defaultFaction) : originalFaction;

  return {
    gameId: FIXTURE_GAME_ID,
    playerId: fixturePlayerId(seat),
    displayName: fixtureName(seat),
    seatNumber: seat,
    lifeStatus: 'ALIVE',
    originalRole: { id: roleId, profileId: original.profile.id, name: original.role.displayName, faction: originalFaction },
    currentRole: { id: currentId, profileId: current.profile.id, name: current.role.displayName, faction: currentFaction },
    abilities: current.profile.abilities.map((a, i) => ({
      abilityInstanceId: fixtureId(1000 + seat * 10 + i),
      abilityId: a.id,
      capability: a.capability,
      timing: a.timing,
      status: 'ACTIVE',
      usesRemaining: a.usesPerGame,
      usesPerPhase: a.usesPerPhase,
      cooldownNights: a.cooldownNights,
      availableFromRound: a.availableFromRound,
      onlyRound: a.onlyRound,
      expiresRound: null,
      target: a.target,
      ...(typeof a.config['exclusiveGroup'] === 'string' ? { exclusiveGroup: a.config['exclusiveGroup'] } : {}),
      ...options.abilities?.[a.id],
    })),
    teammatesVisible: options.teammatesVisible ?? false,
    teammates: [...(options.teammates ?? [])],
  };
}

const teammate = (seat: number): Teammate => ({ playerId: fixturePlayerId(seat), displayName: fixtureName(seat), seatNumber: seat });

/** One projection per case the reveal card has to handle. */
export const ROLE_FIXTURES = {
  /** No abilities: "You have no night action." */
  villager: ownRoleFixture('normal_villager', { seat: 3 }),
  /** A night ability and a day ability. */
  seeker: ownRoleFixture('seeker', { seat: 4 }),
  /** Infection Edition Doctor: acts in the reaction window, unlimited saves. */
  doctor: ownRoleFixture('doctor', { seat: 5, profileId: 'doctor_infection' }),
  /** Two one-use potions, one already spent. */
  witchPoisonUsed: ownRoleFixture('witch', { seat: 6, abilities: { witch_poison: { usesRemaining: 0, status: 'EXHAUSTED' } } }),
  /** Infection wolf: no teammates shown. */
  alphaWolf: ownRoleFixture('alpha_wolf', { seat: 7 }),
  /** Classic Pack Wolf: sees the other wolf, without a role. */
  packWolf: ownRoleFixture('pack_wolf', { seat: 2, teammatesVisible: true, teammates: [teammate(8)] }),
  /** Converted by infection on night 1: the kill opens from night 2. */
  infected: ownRoleFixture('seeker', {
    seat: 9,
    current: { roleId: 'infected_wolf' },
    abilities: { infected_kill: { availableFromRound: 2 } },
  }),
} as const satisfies Record<string, MyRole>;

/** A dealt 20-seat Infection Edition table as the host sees it. Seat 1 is the host. */
export function hostRosterFixture(): HostRoster {
  const config = getPack('infection-core')!.config;
  const seats = Array.from({ length: config.playerCount }, (_, i) => i + 1);
  let n = 0;
  const dealt = dealRoles(config, seats.map(fixturePlayerId), (max) => (n++ * 7) % max);
  return {
    gameId: FIXTURE_GAME_ID,
    phase: 'ROLE_REVEAL',
    roundNumber: 1,
    players: dealt.map((d, i) => ({
      playerId: d.playerId,
      displayName: fixtureName(i + 1),
      seatNumber: i + 1,
      avatarId: i + 1,
      isHost: i === 0,
      lifeStatus: 'ALIVE',
      originalRoleId: d.roleId,
      originalProfileId: d.profileId,
      originalFaction: d.faction,
      currentRoleId: d.roleId,
      currentProfileId: d.profileId,
      currentFaction: d.faction,
      wolfAligned: d.wolfAligned,
      abilities: d.abilities.map((a, j) => ({
        abilityInstanceId: fixtureId(2000 + (i + 1) * 10 + j),
        abilityId: a.abilityId,
        capability: a.definition.capability,
        status: 'ACTIVE' as const,
        usesRemaining: a.chargesRemaining,
      })),
    })),
  };
}

import { randomUUID } from 'node:crypto';
import { hostRosterSchema, myRoleSchema } from '@warewolf/contracts';
import { DEFAULT_CATALOG, dealRoles, getPack, type GameConfiguration } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import { MUTABLE_ASSIGNMENT_FIELDS, type AssignmentChange } from '../src/assignment/assignment.repository.js';
import { hostRosterView, ownRoleView, teammatesVisible } from '../src/assignment/projections.js';
import type { AbilityInstanceRow, GamePlayerRow, RoleAssignmentRow } from '../src/db/schema.js';

const GAME = randomUUID();

/** A dealt table as rows, the way the start transaction writes them. */
function table(config: GameConfiguration, seed = 0) {
  let n = seed;
  const seats: GamePlayerRow[] = Array.from({ length: config.playerCount }, (_, i) => ({
    id: randomUUID(),
    gameId: GAME,
    displayName: `Player ${i + 1}`,
    seatNumber: i + 1,
    avatarId: i + 1,
    isHost: i === 0,
    lifeStatus: 'ALIVE',
    connectionStatus: 'CONNECTED',
    tokenHash: `hash-${i}`,
    diedRound: null,
    createdAt: new Date(),
  }));
  const dealt = dealRoles(config, seats.map((s) => s.id), (max) => n++ % max);
  const assignments: RoleAssignmentRow[] = dealt.map((d) => ({
    id: randomUUID(),
    gameId: GAME,
    playerId: d.playerId,
    originalRoleId: d.roleId,
    originalProfileId: d.profileId,
    originalFaction: d.faction,
    currentRoleId: d.roleId,
    currentProfileId: d.profileId,
    currentFaction: d.faction,
    wolfAligned: d.wolfAligned,
    individualVictory: 'NONE',
    publicReveal: false,
    markTargetPlayerId: null,
    createdAt: new Date(),
  }));
  const abilities: AbilityInstanceRow[] = dealt.flatMap((d, i) =>
    // Reversed, so the projection has to restore the profile order itself.
    [...d.abilities].reverse().map((a) => ({
      id: randomUUID(),
      gameId: GAME,
      playerId: d.playerId,
      assignmentId: assignments[i]!.id,
      abilityId: a.abilityId,
      capability: a.definition.capability,
      handlerKey: a.definition.handlerKey,
      status: 'ACTIVE' as const,
      chargesRemaining: a.chargesRemaining,
      usesConsumed: 0,
      lastUsedRound: null,
      lastTargetPlayerId: null,
      availableFromRound: a.availableFromRound,
      expiresRound: null,
      source: 'NATIVE' as const,
      sourcePlayerId: null,
      config: a.definition,
      revokedReason: null,
      createdAt: new Date(),
    })),
  );
  return { config, seats, assignments, abilities };
}

type Table = ReturnType<typeof table>;

/** What the service hands the builder for one seat: that seat's rows, plus teammate seats when allowed. */
function viewFor(t: Table, seat: GamePlayerRow) {
  const assignment = t.assignments.find((a) => a.playerId === seat.id)!;
  const visible = teammatesVisible(t.config, assignment);
  const wolves = new Set(t.assignments.filter((a) => a.currentFaction === 'WOLF_PACK').map((a) => a.playerId));
  return myRoleSchema.parse(
    ownRoleView({
      game: { id: GAME },
      you: seat,
      assignment,
      abilities: t.abilities.filter((a) => a.assignmentId === assignment.id),
      teammatesVisible: visible,
      teammates: visible ? t.seats.filter((s) => wolves.has(s.id) && s.id !== seat.id) : [],
    }),
  );
}

const ROLE_IDS = DEFAULT_CATALOG.roles.map((r) => r.id);

describe('own role projection', () => {
  const infection = table(getPack('infection-core')!.config);

  it('names no role id other than the caller own, for every seat (WW-403)', () => {
    for (const seat of infection.seats) {
      const view = viewFor(infection, seat);
      const json = JSON.stringify(view);
      const own = new Set([view.originalRole.id, view.currentRole.id]);
      const leaked = ROLE_IDS.filter((id) => !own.has(id) && json.includes(`"${id}"`));
      expect(leaked, `seat ${seat.seatNumber} (${view.currentRole.id})`).toEqual([]);
    }
  });

  it('carries no other seat ability or assignment ids', () => {
    const seat = infection.seats[3]!;
    const json = JSON.stringify(viewFor(infection, seat));
    const others = [
      ...infection.assignments.filter((a) => a.playerId !== seat.id).map((a) => a.id),
      ...infection.abilities.filter((a) => a.playerId !== seat.id).map((a) => a.id),
    ];
    expect(others.filter((id) => json.includes(id))).toEqual([]);
  });

  it('describes the caller role, abilities in profile order, and no teammates in Infection Edition', () => {
    const witchSeat = infection.seats.find((s) => infection.assignments.find((a) => a.playerId === s.id)?.currentRoleId === 'witch')!;
    const view = viewFor(infection, witchSeat);
    expect(view.currentRole).toEqual({ id: 'witch', profileId: 'witch', name: 'Witch', faction: 'VILLAGE' });
    expect(view.originalRole).toEqual(view.currentRole);
    expect(view.abilities.map((a) => [a.abilityId, a.timing, a.usesRemaining])).toEqual([
      ['witch_save', 'NIGHT', 1],
      ['witch_poison', 'NIGHT', 1],
    ]);
    expect(view.abilities[0]!.target).toEqual({ kind: 'PLAYERS', count: 1, life: 'ALIVE', self: true, notSameAsLastRound: false });
    expect(view).toMatchObject({ teammatesVisible: false, teammates: [] });

    const alphaSeat = infection.seats.find((s) => infection.assignments.find((a) => a.playerId === s.id)?.currentRoleId === 'alpha_wolf')!;
    expect(viewFor(infection, alphaSeat)).toMatchObject({ teammatesVisible: false, teammates: [] });
  });

  it('leaves out revoked abilities', () => {
    const seat = infection.seats.find((s) => infection.assignments.find((a) => a.playerId === s.id)?.currentRoleId === 'witch')!;
    const revoked = { ...infection, abilities: infection.abilities.map((a) => (a.abilityId === 'witch_poison' ? { ...a, status: 'REVOKED' as const } : a)) };
    expect(viewFor(revoked, seat).abilities.map((a) => a.abilityId)).toEqual(['witch_save']);
  });

  it('shows Classic Pack Wolves each other by seat and name only', () => {
    const classic = table(getPack('classic-10')!.config);
    const wolfSeats = classic.seats.filter((s) => classic.assignments.find((a) => a.playerId === s.id)?.currentRoleId === 'pack_wolf');
    expect(wolfSeats).toHaveLength(2);

    const [a, b] = wolfSeats as [GamePlayerRow, GamePlayerRow];
    const view = viewFor(classic, a);
    expect(view.teammatesVisible).toBe(true);
    expect(view.teammates).toEqual([{ playerId: b.id, displayName: b.displayName, seatNumber: b.seatNumber }]);

    const villager = classic.seats.find((s) => !wolfSeats.includes(s))!;
    expect(viewFor(classic, villager)).toMatchObject({ teammatesVisible: false, teammates: [] });
  });

  it('refuses rows that belong to someone else', () => {
    const [first, second] = infection.seats as [GamePlayerRow, GamePlayerRow];
    const assignment = infection.assignments.find((a) => a.playerId === second.id)!;
    expect(() =>
      ownRoleView({ game: { id: GAME }, you: first, assignment, abilities: [], teammatesVisible: false, teammates: [] }),
    ).toThrow(/another player/);

    const own = infection.assignments.find((a) => a.playerId === first.id)!;
    const foreign = infection.abilities.find((a) => a.assignmentId !== own.id)!;
    expect(() =>
      ownRoleView({ game: { id: GAME }, you: first, assignment: own, abilities: [foreign], teammatesVisible: false, teammates: [] }),
    ).toThrow(/another assignment/);
  });
});

describe('host roster projection', () => {
  it('lists every seat in order with original and current roles', () => {
    const t = table(getPack('infection-core')!.config, 5);
    const roster = hostRosterSchema.parse(
      hostRosterView({ game: { id: GAME, phase: 'ROLE_REVEAL', roundNumber: 1 }, seats: [...t.seats].reverse(), assignments: t.assignments, abilities: t.abilities }),
    );
    expect(roster.players.map((p) => p.seatNumber)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const roles: Record<string, number> = {};
    for (const p of roster.players) roles[p.originalRoleId] = (roles[p.originalRoleId] ?? 0) + 1;
    expect(roles).toEqual({ alpha_wolf: 1, seeker: 2, guard: 1, doctor: 1, witch: 1, normal_villager: 14 });
    const alpha = roster.players.find((p) => p.currentRoleId === 'alpha_wolf')!;
    expect(alpha.abilities.map((a) => a.abilityId)).toEqual(['alpha_infect', 'alpha_kill']);
    expect(alpha).toMatchObject({ originalFaction: 'WOLF_PACK', currentFaction: 'WOLF_PACK', wolfAligned: true });
  });

  it('fails loudly on a seat without an assignment', () => {
    const t = table(getPack('classic-10')!.config);
    expect(() =>
      hostRosterView({ game: { id: GAME, phase: 'ROLE_REVEAL', roundNumber: 1 }, seats: t.seats, assignments: t.assignments.slice(1), abilities: [] }),
    ).toThrow(/has no assignment/);
  });
});

describe('assignment changes', () => {
  it('cannot name an original field, by type or by list', () => {
    // @ts-expect-error The dealt role is not a mutable field.
    const smuggled: AssignmentChange = { originalRoleId: 'alpha_wolf' };
    expect(smuggled).toBeDefined();
    expect(MUTABLE_ASSIGNMENT_FIELDS.filter((f) => f.startsWith('original'))).toEqual([]);
  });
});

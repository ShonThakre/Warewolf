import { describe, expect, it } from 'vitest';
import { evaluateVictory, type Faction, type VictoryAssignment } from '../src/index.js';

function seat(playerId: string, roleId: string, faction: Faction, life: 'ALIVE' | 'DEAD' = 'ALIVE', extra: Partial<VictoryAssignment> = {}): { player: { id: string; lifeStatus: 'ALIVE' | 'DEAD' }; assignment: VictoryAssignment } {
  return {
    player: { id: playerId, lifeStatus: life },
    assignment: {
      playerId,
      currentRoleId: roleId,
      currentProfileId: roleId,
      currentFaction: faction,
      wolfAligned: faction === 'WOLF_PACK' || roleId === 'lone_wolf',
      individualVictory: 'NONE',
      ...extra,
    },
  };
}

function game(seats: ReturnType<typeof seat>[], extra: Parameters<typeof evaluateVictory>[0] extends infer T ? Partial<T> : never = {}) {
  return evaluateVictory({
    round: 1,
    roundCap: 20,
    players: seats.map((s) => s.player),
    assignments: seats.map((s) => s.assignment),
    ...extra,
  });
}

describe('evaluateVictory', () => {
  it('gives the wolves a win at parity', () => {
    const result = game([seat('w1', 'pack_wolf', 'WOLF_PACK'), seat('w2', 'pack_wolf', 'WOLF_PACK'), seat('v1', 'normal_villager', 'VILLAGE'), seat('v2', 'normal_villager', 'VILLAGE')]);
    expect(result).toMatchObject({ ended: true, team: 'WOLF_PACK', draw: false });
  });

  it('gives the village a win when no wolf-aligned player remains, including the Fox', () => {
    const result = game([seat('fox', 'fox', 'NEUTRAL'), seat('v1', 'normal_villager', 'VILLAGE'), seat('w', 'pack_wolf', 'WOLF_PACK', 'DEAD')]);
    expect(result.team).toBe('VILLAGE');
    expect(result.individuals).toContainEqual({ playerId: 'fox', trigger: 'ALL_WOLVES_ELIMINATED_WHILE_ALIVE', state: 'ACHIEVED' });
  });

  it('draws when nobody qualifies, and draws at the round cap', () => {
    const empty = game([seat('j', 'jester', 'NEUTRAL', 'DEAD')]);
    expect(empty).toMatchObject({ ended: true, team: null, draw: true });
    const capped = game([seat('w', 'pack_wolf', 'WOLF_PACK'), seat('v1', 'normal_villager', 'VILLAGE'), seat('v2', 'normal_villager', 'VILLAGE')], { round: 20, roundCap: 20 });
    expect(capped).toMatchObject({ ended: true, draw: true, team: null });
  });

  it('records each Ultimate trigger', () => {
    const joker = game([
      seat('j', 'joker', 'NEUTRAL', 'DEAD'),
      seat('w', 'pack_wolf', 'WOLF_PACK'),
      seat('v1', 'normal_villager', 'VILLAGE'),
      seat('v2', 'normal_villager', 'VILLAGE'),
    ], { dayEliminated: ['j'] });
    expect(joker.individuals).toContainEqual({ playerId: 'j', trigger: 'ELIMINATED_BY_DAY_VOTE', state: 'ACHIEVED' });
    expect(joker.ended).toBe(false);

    const vampire = game([seat('vam', 'vampire', 'NEUTRAL'), seat('srv', 'vampire_servant', 'NEUTRAL', 'DEAD')], { roundCapReached: true, round: 3 });
    expect(vampire.individuals).toEqual(expect.arrayContaining([
      { playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' },
      { playerId: 'srv', trigger: 'WITH_VAMPIRE', state: 'ACHIEVED' },
    ]));

    const necro = game([seat('n', 'necromancer', 'NEUTRAL')], { roundCapReached: true, revivedBy: ['n'] });
    expect(necro.individuals).toContainEqual({ playerId: 'n', trigger: 'ALIVE_AFTER_REVIVE', state: 'ACHIEVED' });

    const demon = game([
      seat('c', 'chaos_demon', 'INDEPENDENT'),
      seat('v', 'normal_villager', 'VILLAGE'),
      seat('w', 'pack_wolf', 'WOLF_PACK'),
    ], { chaosSuccesses: 3 });
    expect(demon.chaosAchieved).toBe(true);
    expect(demon.individuals).toContainEqual({ playerId: 'c', trigger: 'CHAOS_THREE_AND_FINAL_FIVE', state: 'ACHIEVED' });
    expect(demon.ended).toBe(false);

    const later = game([
      seat('c', 'chaos_demon', 'INDEPENDENT'),
      seat('v1', 'normal_villager', 'VILLAGE'),
      seat('v2', 'normal_villager', 'VILLAGE'),
      seat('v3', 'normal_villager', 'VILLAGE'),
      seat('v4', 'normal_villager', 'VILLAGE'),
      seat('w', 'pack_wolf', 'WOLF_PACK'),
    ], { chaosAchieved: true });
    expect(later.chaosAchieved).toBe(true);
    expect(later.individuals).toContainEqual({ playerId: 'c', trigger: 'CHAOS_THREE_AND_FINAL_FIVE', state: 'ACHIEVED' });
  });

  it('revokes an individual win when the role is converted', () => {
    const result = game([
      seat('f', 'infected_wolf', 'WOLF_PACK', 'ALIVE', { individualVictory: 'ACHIEVED', revokedTrigger: 'ALL_WOLVES_ELIMINATED_WHILE_ALIVE' }),
      seat('v1', 'normal_villager', 'VILLAGE'),
      seat('v2', 'normal_villager', 'VILLAGE'),
    ]);
    expect(result.individuals).toContainEqual({ playerId: 'f', trigger: 'ALL_WOLVES_ELIMINATED_WHILE_ALIVE', state: 'REVOKED' });
    expect(result.ended).toBe(false);
  });

  it('ends on a team win and keeps the individual records', () => {
    const result = game([
      seat('j', 'joker', 'NEUTRAL', 'DEAD'),
      seat('v', 'normal_villager', 'VILLAGE'),
    ], { dayEliminated: ['j'] });
    expect(result.ended).toBe(true);
    expect(result.team).toBe('VILLAGE');
    expect(result.individuals).toContainEqual({ playerId: 'j', trigger: 'ELIMINATED_BY_DAY_VOTE', state: 'ACHIEVED' });
  });
});

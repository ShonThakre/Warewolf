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

  it('counts an infected villager as a wolf, alive at parity and after the vote removes them', () => {
    const infected = (life: 'ALIVE' | 'DEAD') => seat('i1', 'infected_wolf', 'WOLF_PACK', life, { currentProfileId: 'infected_wolf' });
    const alpha = seat('a', 'alpha_wolf', 'WOLF_PACK');
    const villagers = [seat('v1', 'normal_villager', 'VILLAGE'), seat('v2', 'normal_villager', 'VILLAGE')];
    expect(game([alpha, infected('ALIVE'), ...villagers])).toMatchObject({ ended: true, team: 'WOLF_PACK' });
    // Voted out: one wolf fewer, not one villager fewer. The Alpha still blocks a Village win.
    const voted = game([alpha, infected('DEAD'), ...villagers, seat('v3', 'normal_villager', 'VILLAGE')], { dayEliminated: ['i1'] });
    expect(voted).toMatchObject({ ended: false, team: null });
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

    const deadServant = game([
      seat('vam', 'vampire', 'NEUTRAL'),
      seat('srv', 'vampire_servant', 'NEUTRAL', 'DEAD'),
      seat('v', 'normal_villager', 'VILLAGE'),
      seat('w', 'pack_wolf', 'WOLF_PACK'),
    ], { roundCapReached: true, round: 3 });
    expect(deadServant.individuals).not.toContainEqual({ playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' });

    const vampire = game([seat('vam', 'vampire', 'NEUTRAL'), seat('srv', 'vampire_servant', 'NEUTRAL')], { roundCapReached: true, round: 3 });
    expect(vampire.individuals).toEqual(expect.arrayContaining([
      { playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' },
      { playerId: 'srv', trigger: 'WITH_VAMPIRE', state: 'ACHIEVED' },
    ]));

    const wipe = game([
      seat('vam', 'vampire', 'NEUTRAL'),
      seat('srv', 'vampire_servant', 'NEUTRAL'),
      seat('v', 'normal_villager', 'VILLAGE', 'DEAD'),
      seat('w', 'pack_wolf', 'WOLF_PACK', 'DEAD'),
    ]);
    expect(wipe).toMatchObject({ ended: true, team: null, draw: false });
    expect(wipe.individuals).toEqual(expect.arrayContaining([
      { playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' },
      { playerId: 'srv', trigger: 'WITH_VAMPIRE', state: 'ACHIEVED' },
    ]));

    const vampireAlone = game([
      seat('vam', 'vampire', 'NEUTRAL'),
      seat('v', 'normal_villager', 'VILLAGE', 'DEAD'),
      seat('w', 'pack_wolf', 'WOLF_PACK', 'DEAD'),
    ]);
    expect(vampireAlone).toMatchObject({ ended: true, team: null, draw: false });
    expect(vampireAlone.individuals).toContainEqual({ playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' });

    const servantsAlone = game([
      seat('vam', 'vampire', 'NEUTRAL', 'DEAD'),
      seat('srv', 'vampire_servant', 'NEUTRAL'),
      seat('v', 'normal_villager', 'VILLAGE', 'DEAD'),
      seat('w', 'pack_wolf', 'WOLF_PACK', 'DEAD'),
    ]);
    expect(servantsAlone.individuals).toContainEqual({ playerId: 'srv', trigger: 'WITH_VAMPIRE', state: 'ACHIEVED' });
    expect(servantsAlone.individuals).not.toContainEqual({ playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' });

    const besideVillage = game([
      seat('vam', 'vampire', 'NEUTRAL'),
      seat('srv', 'vampire_servant', 'NEUTRAL'),
      seat('v', 'normal_villager', 'VILLAGE'),
      seat('w', 'pack_wolf', 'WOLF_PACK', 'DEAD'),
    ]);
    expect(besideVillage.team).toBe('VILLAGE');
    expect(besideVillage.individuals).toContainEqual({ playerId: 'vam', trigger: 'ALIVE_WITH_SERVANT', state: 'ACHIEVED' });

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

  it('gives the Assassin a mark win when the marked seat is dead', () => {
    const pending = game([
      seat('a', 'assassin', 'NEUTRAL', 'ALIVE', { currentProfileId: 'assassin_mark', markTargetPlayerId: 'v1' }),
      seat('v1', 'normal_villager', 'VILLAGE'),
      seat('v2', 'normal_villager', 'VILLAGE'),
      seat('w', 'pack_wolf', 'WOLF_PACK'),
    ]);
    expect(pending.individuals).not.toContainEqual({ playerId: 'a', trigger: 'MARKED_TARGET_ELIMINATED', state: 'ACHIEVED' });
    expect(pending.ended).toBe(false);

    const won = game([
      seat('a', 'assassin', 'NEUTRAL', 'ALIVE', { currentProfileId: 'assassin_mark', markTargetPlayerId: 'v1' }),
      seat('v1', 'normal_villager', 'VILLAGE', 'DEAD'),
      seat('v2', 'normal_villager', 'VILLAGE'),
      seat('w', 'pack_wolf', 'WOLF_PACK'),
    ]);
    expect(won.individuals).toContainEqual({ playerId: 'a', trigger: 'MARKED_TARGET_ELIMINATED', state: 'ACHIEVED' });
    expect(won.ended).toBe(false);
  });

  it('gives the Lone Wolf a win only as the sole survivor', () => {
    const withCompany = game([
      seat('lone', 'lone_wolf', 'INDEPENDENT'),
      seat('v', 'normal_villager', 'VILLAGE'),
    ]);
    expect(withCompany.individuals).not.toContainEqual({ playerId: 'lone', trigger: 'SOLE_SURVIVOR', state: 'ACHIEVED' });

    const alone = game([seat('lone', 'lone_wolf', 'INDEPENDENT')]);
    expect(alone.individuals).toContainEqual({ playerId: 'lone', trigger: 'SOLE_SURVIVOR', state: 'ACHIEVED' });
    expect(alone.ended).toBe(true);
  });
});

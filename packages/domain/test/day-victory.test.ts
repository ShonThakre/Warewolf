import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, evaluateVictory, tallyDay, type TallyAbility, type VictoryAssignment, type VictoryPlayer } from '../src/index.js';

/**
 * WW-901 and WW-902. A first tie does not eliminate. A second tie does not
 * either (OD-40). Two wolves and two others is a wolf win. A Jester's day
 * vote win does not end the game.
 */

const alive = (id: string): VictoryPlayer => ({ id, lifeStatus: 'ALIVE' });
const dead = (id: string): VictoryPlayer => ({ id, lifeStatus: 'DEAD' });

function seat(playerId: string, faction: VictoryAssignment['currentFaction'], wolfAligned: boolean, roleId = 'normal_villager'): VictoryAssignment {
  return {
    playerId,
    currentRoleId: roleId,
    currentProfileId: roleId,
    currentFaction: faction,
    wolfAligned,
    individualVictory: 'NONE',
  };
}

const players = (ids: string[]) => ids.map((id) => ({ id, lifeStatus: 'ALIVE' as const }));

describe('tallyDay', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const base = { round: 1, players: players(ids), assignments: [], abilities: [] as readonly TallyAbility[] };

  it('eliminates a unique leader and treats a tie as no elimination', () => {
    const clear = tallyDay({ ...base, ballot: 'FIRST', votes: [
      { voterId: 'a', targetId: 'd' },
      { voterId: 'b', targetId: 'd' },
      { voterId: 'c', targetId: 'a' },
    ] });
    expect(clear.eliminated).toBe('d');
    expect(clear.tied).toEqual([]);

    const tie = tallyDay({ ...base, ballot: 'FIRST', votes: [
      { voterId: 'a', targetId: 'c' },
      { voterId: 'b', targetId: 'd' },
    ] });
    expect(tie.eliminated).toBeNull();
    expect(tie.tied).toEqual(['c', 'd']);
  });

  it('eliminates nobody when the revote ties again, and eliminates a unique revote leader', () => {
    const again = tallyDay({ ...base, ballot: 'REVOTE', votes: [
      { voterId: 'a', targetId: 'c' },
      { voterId: 'b', targetId: 'd' },
    ] });
    expect(again.eliminated).toBeNull();
    expect(again.tied).toEqual(['c', 'd']);

    const decided = tallyDay({ ...base, ballot: 'REVOTE', votes: [
      { voterId: 'a', targetId: 'c' },
      { voterId: 'b', targetId: 'c' },
    ] });
    expect(decided.eliminated).toBe('c');
  });

  it('counts an abstention as no vote', () => {
    const result = tallyDay({ ...base, ballot: 'FIRST', votes: [
      { voterId: 'a', targetId: null },
      { voterId: 'b', targetId: null },
    ] });
    expect(result.eliminated).toBeNull();
    expect(result.tied).toEqual([]);
  });

  it('adds vote-modifier extras instead of multiplying them', () => {
    const elder = DEFAULT_CATALOG.byId.get('elder')!.profiles['elder']!.abilities[0]!;
    const mayor = DEFAULT_CATALOG.byId.get('mayor')!.profiles['mayor']!.abilities[0]!;
    const abilities: TallyAbility[] = [
      { playerId: 'a', status: 'ACTIVE', config: elder },
      { playerId: 'a', status: 'ACTIVE', config: mayor },
    ];
    const result = tallyDay({
      ...base,
      ballot: 'FIRST',
      abilities,
      votes: [
        { voterId: 'a', targetId: 'd' },
        { voterId: 'b', targetId: 'c' },
        { voterId: 'c', targetId: 'c' },
      ],
    });
    expect(result.counts['d']).toBe(3);
    expect(result.counts['c']).toBe(2);
    expect(result.eliminated).toBe('d');
  });
});

describe('evaluateVictory', () => {
  const round = { round: 1, roundCap: 20 };

  it('treats equal wolves and others as a wolf win', () => {
    const result = evaluateVictory({
      ...round,
      players: [alive('w1'), alive('w2'), alive('v1'), alive('v2')],
      assignments: [
        seat('w1', 'WOLF_PACK', true, 'pack_wolf'),
        seat('w2', 'WOLF_PACK', true, 'pack_wolf'),
        seat('v1', 'VILLAGE', false),
        seat('v2', 'VILLAGE', false),
      ],
    });
    expect(result.ended).toBe(true);
    expect(result.team).toBe('WOLF_PACK');
    expect(result.draw).toBe(false);
  });

  it('does not end the game when a Jester is voted out and wolves remain', () => {
    const result = evaluateVictory({
      ...round,
      players: [dead('j'), alive('w'), alive('v1'), alive('v2')],
      assignments: [
        seat('j', 'NEUTRAL', false, 'jester'),
        seat('w', 'WOLF_PACK', true, 'pack_wolf'),
        seat('v1', 'VILLAGE', false),
        seat('v2', 'VILLAGE', false),
      ],
      dayEliminated: ['j'],
    });
    expect(result.ended).toBe(false);
    expect(result.individuals).toContainEqual({ playerId: 'j', trigger: 'ELIMINATED_BY_DAY_VOTE', state: 'ACHIEVED' });
  });

  it('keeps the Jester when the same resolution also ends the game', () => {
    const result = evaluateVictory({
      ...round,
      players: [dead('j'), dead('w'), alive('v')],
      assignments: [
        seat('j', 'NEUTRAL', false, 'jester'),
        seat('w', 'WOLF_PACK', true, 'pack_wolf'),
        seat('v', 'VILLAGE', false),
      ],
      dayEliminated: ['j'],
    });
    expect(result.ended).toBe(true);
    expect(result.team).toBe('VILLAGE');
    expect(result.individuals).toContainEqual({ playerId: 'j', trigger: 'ELIMINATED_BY_DAY_VOTE', state: 'ACHIEVED' });
  });

  it('does not give the Jester a night death', () => {
    const result = evaluateVictory({
      ...round,
      players: [dead('j'), alive('w'), alive('v1'), alive('v2')],
      assignments: [
        seat('j', 'NEUTRAL', false, 'jester'),
        seat('w', 'WOLF_PACK', true, 'pack_wolf'),
        seat('v1', 'VILLAGE', false),
        seat('v2', 'VILLAGE', false),
      ],
    });
    expect(result.ended).toBe(false);
    expect(result.individuals).toEqual([]);
  });

  it('draws an empty table instead of awarding both teams', () => {
    const result = evaluateVictory({
      ...round,
      players: [dead('w'), dead('v')],
      assignments: [seat('w', 'WOLF_PACK', true, 'pack_wolf'), seat('v', 'VILLAGE', false)],
    });
    expect(result.ended).toBe(true);
    expect(result.draw).toBe(true);
    expect(result.team).toBeNull();
  });
});

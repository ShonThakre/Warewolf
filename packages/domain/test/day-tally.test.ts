import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, tallyDay, type AbilityDefinition, type TallyVote } from '../src/index.js';

const alive = (...ids: string[]) => ids.map((id) => ({ id, lifeStatus: 'ALIVE' as const }));
const vote = (voterId: string, targetId: string | null): TallyVote => ({ voterId, targetId });
const role = (playerId: string, roleId: string) => ({ playerId, currentRoleId: roleId, currentProfileId: roleId === 'joker' ? 'joker' : roleId });

function weight(playerId: string, value: number) {
  const definition = DEFAULT_CATALOG.byId.get('elder')!.profiles['elder']!.abilities[0]!;
  const config: AbilityDefinition = { ...definition, config: { ...definition.config, weight: value } };
  return { playerId, status: 'ACTIVE' as const, config };
}

describe('tallyDay', () => {
  const players = alive('a', 'b', 'c', 'd');

  it('eliminates the unique majority', () => {
    const result = tallyDay({ round: 1, ballot: 'FIRST', players, assignments: [], abilities: [], votes: [vote('a', 'd'), vote('b', 'd'), vote('c', 'a')] });
    expect(result.eliminated).toBe('d');
    expect(result.tied).toEqual([]);
    expect(result.counts).toEqual({ a: 1, d: 2 });
  });

  it('reports a first-ballot tie and eliminates nobody on the revote', () => {
    const votes = [vote('a', 'c'), vote('b', 'd')];
    const first = tallyDay({ round: 1, ballot: 'FIRST', players, assignments: [], abilities: [], votes });
    expect(first.eliminated).toBeNull();
    expect(first.tied).toEqual(['c', 'd']);
    const revote = tallyDay({ round: 1, ballot: 'REVOTE', players, assignments: [], abilities: [], votes });
    expect(revote.eliminated).toBeNull();
  });

  it('weights a vote and ignores a dead voter', () => {
    const result = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players: [...alive('a', 'b', 'c'), { id: 'd', lifeStatus: 'DEAD' }],
      assignments: [],
      abilities: [weight('a', 2)],
      votes: [vote('a', 'c'), vote('b', 'b'), vote('d', 'b')],
    });
    expect(result.counts).toEqual({ b: 1, c: 2 });
    expect(result.eliminated).toBe('c');
  });

  it('redirects a cast ballot and leaves an abstention', () => {
    const result = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players,
      assignments: [],
      abilities: [],
      votes: [vote('a', 'b'), vote('c', null)],
      mindControl: [
        { voterId: 'a', targetId: 'd' },
        { voterId: 'c', targetId: 'd' },
      ],
    });
    expect(result.counts).toEqual({ d: 1 });
    expect(result.actionOutcomes).toEqual([
      { kind: 'MIND_CONTROL', voterId: 'a', applied: true },
      { kind: 'MIND_CONTROL', voterId: 'c', applied: false },
    ]);
  });

  it('applies no-vote, then a swap, then a double vote', () => {
    const votes = [vote('a', 'd'), vote('b', 'd'), vote('c', 'a')];
    const silenced = tallyDay({ round: 1, ballot: 'FIRST', players, assignments: [], abilities: [], votes, chaosEffects: [{ kind: 'NO_VOTE', playerIds: [] }] });
    expect(silenced.eliminated).toBeNull();
    expect(silenced.counts).toEqual({});
    expect(silenced.chaosOutcomes[0]).toEqual({ kind: 'NO_VOTE', applied: true });
    const abstained = tallyDay({ round: 1, ballot: 'FIRST', players, assignments: [], abilities: [], votes: [vote('a', null)], chaosEffects: [{ kind: 'NO_VOTE', playerIds: [] }] });
    expect(abstained.chaosOutcomes[0]).toEqual({ kind: 'NO_VOTE', applied: false });

    const swapped = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players,
      assignments: [],
      abilities: [],
      votes: [vote('a', 'b'), vote('b', 'a'), vote('c', 'a')],
      chaosEffects: [{ kind: 'SWAP_VOTES', playerIds: ['a', 'b'] }],
    });
    expect(swapped.counts).toEqual({ a: 2, b: 1 });

    const doubled = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players,
      assignments: [],
      abilities: [],
      votes: [vote('a', 'd'), vote('b', 'c')],
      chaosEffects: [{ kind: 'DOUBLE_VOTE', playerIds: ['a'] }],
    });
    expect(doubled.counts).toEqual({ c: 1, d: 2 });
    expect(doubled.chaosOutcomes[0]?.applied).toBe(true);
  });

  it('records a Joker eliminated by the vote', () => {
    const result = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players,
      assignments: [role('d', 'joker')],
      abilities: [],
      votes: [vote('a', 'd'), vote('b', 'd')],
    });
    expect(result.eliminated).toBe('d');
    expect(result.individualWins).toEqual([{ playerId: 'd', trigger: 'ELIMINATED_BY_DAY_VOTE' }]);
  });

  it('OD-33: after an Elder wolf kill, village votes weight 1 and a phantom ties the village plurality', () => {
    const assignments = [
      { playerId: 'a', currentRoleId: 'mayor', currentProfileId: 'mayor', currentFaction: 'VILLAGE' as const },
      { playerId: 'b', currentRoleId: 'normal_villager', currentProfileId: 'normal_villager', currentFaction: 'VILLAGE' as const },
      { playerId: 'c', currentRoleId: 'pack_wolf', currentProfileId: 'pack_wolf', currentFaction: 'WOLF_PACK' as const },
      { playerId: 'd', currentRoleId: 'normal_villager', currentProfileId: 'normal_villager', currentFaction: 'VILLAGE' as const },
    ];
    // Without the penalty, Mayor (weight 2) + villager on d beats the wolf's vote on a.
    const plain = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players,
      assignments,
      abilities: [weight('a', 2)],
      votes: [vote('a', 'd'), vote('b', 'd'), vote('c', 'a')],
    });
    expect(plain.counts).toEqual({ a: 1, d: 3 });
    expect(plain.eliminated).toBe('d');

    // With the penalty, village votes are 1 each (Mayor stripped), d has 2, then phantom +1 on a → tie.
    const penalized = tallyDay({
      round: 1,
      ballot: 'FIRST',
      players,
      assignments,
      abilities: [weight('a', 2)],
      votes: [vote('a', 'd'), vote('b', 'd'), vote('c', 'a')],
      elderPenalty: true,
    });
    expect(penalized.counts).toEqual({ a: 2, d: 2 });
    expect(penalized.eliminated).toBeNull();
    expect(penalized.tied).toEqual(['a', 'd']);
  });
});

import { describe, expect, it } from 'vitest';
import { morningHeadline, morningSurvivors } from '../../src/game/components/morningCopy';
import { fixtureName, fixturePlayerId } from '../../src/game/fixtures/role';

describe('morning copy', () => {
  it('names public eliminations and otherwise says nobody died', () => {
    expect(morningHeadline([])).toBe('No one was eliminated last night.');
    expect(morningHeadline(['You saw a Wolf.', 'Rafi was eliminated.'])).toBe('Rafi was eliminated.');
    expect(morningHeadline(['Rafi was eliminated.', 'Ines was eliminated.'])).toBe('Rafi was eliminated. Ines was eliminated.');
  });

  it('lists only living seats as survivors', () => {
    const players = [
      { playerId: fixturePlayerId(1), displayName: fixtureName(1), avatarId: 1, lifeStatus: 'ALIVE' },
      { playerId: fixturePlayerId(2), displayName: fixtureName(2), avatarId: 2, lifeStatus: 'DEAD' },
      { playerId: fixturePlayerId(3), displayName: fixtureName(3), avatarId: 3, lifeStatus: 'ALIVE' },
    ];
    expect(morningSurvivors(players).map((player) => player.displayName)).toEqual([fixtureName(1), fixtureName(3)]);
  });
});

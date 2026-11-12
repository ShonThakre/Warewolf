import { describe, expect, it } from 'vitest';
import { createRng, isLegalStep, secretKeys } from '../src/index.js';

describe('invariants', () => {
  it('follows the phase machine', () => {
    expect(isLegalStep('NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM')).toBe(true);
    expect(isLegalStep('VOTING', 'REVOTE')).toBe(true);
    expect(isLegalStep('REVOTE', 'FINISHED')).toBe(true);
    expect(isLegalStep('DAY_ANNOUNCE', 'VOTING')).toBe(false);
    expect(isLegalStep('ROLE_REVEAL', 'DAY_ANNOUNCE')).toBe(false);
  });

  it('finds role keys anywhere in a body', () => {
    expect(secretKeys({ players: [{ playerId: 'a' }], you: { isHost: true } })).toEqual([]);
    expect(secretKeys({ players: [{ playerId: 'a', currentRoleId: 'seeker' }] })).toEqual(['$.players[0].currentRoleId']);
  });
});

describe('createRng', () => {
  it('replays from a seed', () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a.next(), a.int(10), a.sample([1, 2, 3, 4], 2)]).toEqual([b.next(), b.int(10), b.sample([1, 2, 3, 4], 2)]);
  });

  it('samples without repeats', () => {
    const picked = createRng(1).sample([1, 2, 3, 4, 5], 5);
    expect(new Set(picked).size).toBe(5);
  });
});

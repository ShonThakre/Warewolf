import { describe, expect, it } from 'vitest';
import { exclusiveNote } from '../../src/game/components/actionCopy';
import { lockedModeCopy } from '../../src/game/setup/setupCopy';

describe('Ultimate 20 copy', () => {
  it('tells the host the Vampire team chooses one action, and leaves Infection copy alone', () => {
    expect(lockedModeCopy('ULTIMATE_20')).toContain('The Vampire team chooses either a kill or a mark each night.');
    expect(lockedModeCopy('INFECTION')).toBe(
      'Infection Edition is locked at 20 players: 1 Alpha Wolf, 2 Seekers, 1 Guard, 1 Doctor, 1 Witch, and 14 Villagers. Infection stays silent, wolves do not know each other, and friendly fire is on. Choose another mode to edit the setup.',
    );
    expect(lockedModeCopy('CLASSIC')).toBeNull();
  });

  it('names the Vampire exclusive choice and keeps the other exclusive note', () => {
    expect(exclusiveNote('vampire_choice')).toBe('The Vampire team chooses one action tonight: kill or mark.');
    expect(exclusiveNote('alpha_choice')).toBe('This replaces your other choice.');
    expect(exclusiveNote(undefined)).toBeNull();
  });
});

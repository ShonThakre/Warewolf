import type { DayTally } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { abstentionLine, shownTally, tallyResult } from '../../src/game/components/tallyCopy';

const tie: DayTally = {
  roundNumber: 1,
  ballot: 1,
  counts: [
    { targetPlayerId: 'a', total: 2 },
    { targetPlayerId: 'b', total: 2 },
  ],
  abstentions: 1,
  votedOutPlayerId: null,
  tiedPlayerIds: ['a', 'b'],
};

const nameOf = (id: string) => (id === 'a' ? 'Mira' : 'Rafi');

describe('tally copy', () => {
  it('hides every count while a ballot is open', () => {
    expect(shownTally('VOTING', tie)).toBeNull();
    expect(shownTally('REVOTE', tie)).toBe(tie);
    expect(shownTally('DAY_ANNOUNCE', tie)).toBe(tie);
  });

  it('names a first tie as a revote and a second tie as nobody', () => {
    expect(tallyResult(tie, nameOf)).toBe('Revote between Mira and Rafi.');
    expect(tallyResult({ ...tie, ballot: 2 }, nameOf)).toBe('Nobody was eliminated. Mira and Rafi tied.');
    expect(abstentionLine(1)).toBe('1 abstention');
    expect(abstentionLine(0)).toBeNull();
  });
});

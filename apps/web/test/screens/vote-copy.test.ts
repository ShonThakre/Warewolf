import { describe, expect, it } from 'vitest';
import { canCastBallot, voteMatches, voteRowText, type VoteChoice } from '../../src/game/components/voteCopy';

const rafi: VoteChoice = { kind: 'player', playerId: 'rafi' };
const abstain: VoteChoice = { kind: 'abstain' };

describe('vote copy', () => {
  it('lets a living player vote only during a ballot', () => {
    expect(canCastBallot({ lifeStatus: 'ALIVE' }, 'VOTING')).toBe(true);
    expect(canCastBallot({ lifeStatus: 'ALIVE' }, 'REVOTE')).toBe(true);
    expect(canCastBallot({ lifeStatus: 'ALIVE' }, 'DAY_DISCUSSION')).toBe(false);
    expect(canCastBallot({ lifeStatus: 'DEAD' }, 'VOTING')).toBe(false);
  });

  it('treats a stored abstention and a stored player as different choices', () => {
    expect(voteMatches(rafi, 'rafi')).toBe(true);
    expect(voteMatches(rafi, null)).toBe(false);
    expect(voteMatches(abstain, null)).toBe(true);
    expect(voteMatches(null, null)).toBe(false);
    expect(voteMatches(rafi, undefined)).toBe(false);
  });

  it('names the choice, and a revote asks for a tied player', () => {
    expect(voteRowText({ phase: 'VOTING', canVote: false, choice: null, name: null, stored: false })).toBe('You cannot vote.');
    expect(voteRowText({ phase: 'VOTING', canVote: true, choice: null, name: null, stored: false })).toBe('Choose a player to eliminate, or abstain.');
    expect(voteRowText({ phase: 'REVOTE', canVote: true, choice: null, name: null, stored: false })).toBe('Choose one of the tied players, or abstain.');
    expect(voteRowText({ phase: 'VOTING', canVote: true, choice: rafi, name: 'Rafi', stored: true })).toContain('Your vote is Rafi');
    expect(voteRowText({ phase: 'VOTING', canVote: true, choice: abstain, name: null, stored: true })).toContain('You abstained');
  });
});

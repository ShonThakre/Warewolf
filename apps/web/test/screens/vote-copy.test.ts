import { describe, expect, it } from 'vitest';
import {
  canCastBallot,
  revoteBoardCopy,
  revoteDiscussionNotice,
  revoteTargets,
  showAbstain,
  UNKNOWN_VOTE_RULES,
  voteButtonLabel,
  voteLifeLabel,
  voteMatches,
  votePrivacyCopy,
  voteRowText,
  voteSeatLabel,
  type VoteChoice,
} from '../../src/game/components/voteCopy';

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

  it('labels seats and life for the voting cards', () => {
    expect(voteSeatLabel(1, 'Alice')).toBe('Seat 1 • Alice');
    expect(voteSeatLabel(3, 'Ava', 'colon')).toBe('Seat 3: Ava');
    expect(voteLifeLabel('ALIVE')).toBe('Living');
    expect(voteLifeLabel('DEAD')).toBe('Eliminated');
    expect(votePrivacyCopy()).toBe('Your vote is private.');
    expect(votePrivacyCopy('REVOTE')).toBe('Your vote is private and hidden from other players.');
    expect(revoteBoardCopy().title).toBe('Revote.');
    expect(revoteDiscussionNotice().title).toBe('Day • Revote');
  });
});

describe('revote and ballot buttons', () => {
  const tally = (roundNumber: number, ballot: 1 | 2, tied: string[]) => ({ roundNumber, ballot, counts: [], abstentions: 0, votedOutPlayerId: null, tiedPlayerIds: tied });

  it('limits a revote to the tied players of this round', () => {
    const tallies = [tally(1, 1, ['a', 'b']), tally(2, 1, ['c', 'd'])];
    expect(revoteTargets('VOTING', 2, tallies)).toBeNull();
    expect([...(revoteTargets('REVOTE', 2, tallies) ?? [])]).toEqual(['c', 'd']);
    expect(revoteTargets('REVOTE', 3, tallies)).toBeNull();
  });

  it('separates confirming, changing, and a sent vote', () => {
    expect(voteButtonLabel({ hasStored: false, stored: false, casting: false })).toBe('Submit vote');
    expect(voteButtonLabel({ hasStored: false, stored: false, casting: false, phase: 'REVOTE' })).toBe('Submit revote');
    expect(voteButtonLabel({ hasStored: true, stored: false, casting: false })).toBe('Change vote');
    expect(voteButtonLabel({ hasStored: true, stored: true, casting: false })).toBe('Vote sent');
    expect(voteButtonLabel({ hasStored: false, stored: false, casting: true })).toBe('Sending…');
    expect(voteRowText({ phase: 'VOTING', canVote: true, choice: rafi, name: 'Rafi', stored: false })).toBe('Selected: Rafi. Not sent yet.');
  });

  it('avoids promising a change when the room rules are unknown', () => {
    expect(voteRowText({ phase: 'VOTING', canVote: true, choice: rafi, name: 'Rafi', stored: true, rules: UNKNOWN_VOTE_RULES })).toContain('host settings');
    expect(voteRowText({ phase: 'VOTING', canVote: true, choice: rafi, name: 'Rafi', stored: true, rules: { canAbstain: true, canChange: false } })).toContain('locked');
    expect(showAbstain({ canAbstain: false, canChange: true })).toBe(false);
    expect(voteButtonLabel({ hasStored: true, stored: false, casting: false, canChange: false })).toBe('Vote locked');
  });
});

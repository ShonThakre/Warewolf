import { describe, expect, it } from 'vitest';
import { acknowledgementCopy, blockerSentence, explainIssue, returnSeatLabel, startSentences } from '../../src/game/components/lobbyCopy';

describe('lobby copy', () => {
  it('names the open seats', () => {
    expect(blockerSentence('SEATS_OPEN', 2, 20)).toBe('Room not ready: 18 more seats are needed to start (2 / 20).');
    expect(blockerSentence('SEATS_OVER', 21, 20)).toMatch(/more players/);
    expect(blockerSentence('CONFIG_INVALID', 20, 20)).toMatch(/host needs to fix the role setup/);
    expect(blockerSentence('NOT_LOBBY', 20, 20)).toMatch(/no longer accepting/);
  });

  it('says nothing extra when the room can start', () => {
    expect(
      startSentences({ status: 'LOBBY', ready: true, blockers: [], requiresWarningAcknowledgement: false, seated: 20, seats: 20 }),
    ).toEqual([]);
  });

  it('names warnings that still need acknowledgement', () => {
    expect(
      startSentences({ status: 'LOBBY', ready: true, blockers: [], requiresWarningAcknowledgement: true, seated: 20, seats: 20 }),
    ).toEqual(['Warnings still need acknowledgement.']);
  });

  it('explains a low wolf cap and a short role list', () => {
    expect(explainIssue({ code: 'DECISION_UNSET', message: 'OD-03 (x) needs an acknowledgement before start.', decisionIds: ['OD-03'] })).toBe(
      'Choose what happens when an infected player is also killed that night. It is under Infection on the Settings step.',
    );
    expect(explainIssue({ code: 'DECISION_UNSET', message: 'raw', decisionIds: ['OD-01'] })).toBe(
      'Choose a rule for "how wolf submissions become one final kill target" on the Settings step.',
    );
    expect(explainIssue({ code: 'INFECTION_WITHOUT_ALPHA', message: 'raw' })).toContain('no Alpha Wolf is seated');
    expect(explainIssue({ code: 'WOLF_CAP', message: 'The wolf cap (0) is below the starting pack (1).' })).toBe(
      'Raise the wolf cap from 0 to at least 1. 1 wolf is dealt at the start. The cap is the most wolves allowed, including players who turn into wolves during the game. Change it on the Settings step.',
    );
    expect(explainIssue({ code: 'ROLE_COUNT_MISMATCH', message: 'Roles fill 0 seats but the game has 10 players.' })).toBe(
      'The roles fill 0 of 10 seats. Add 10 more role seats.',
    );
    expect(explainIssue({ code: 'ROLE_COUNT_MISMATCH', message: 'Roles fill 7 seats but the game has 6 players.' })).toBe(
      'The roles fill 7 seats, but this game has 6 players. Remove 1 role seat.',
    );
  });

  it('uses the problem sentences instead of the generic setup line', () => {
    expect(
      startSentences({
        status: 'LOBBY',
        ready: false,
        blockers: ['CONFIG_INVALID'],
        requiresWarningAcknowledgement: false,
        seated: 6,
        seats: 6,
        problems: ['Raise the wolf cap from 0 to at least 1.'],
      }),
    ).toEqual(['Raise the wolf cap from 0 to at least 1.']);
  });

  it('says when a room was cancelled', () => {
    expect(startSentences({ status: 'CANCELLED', ready: false, blockers: ['NOT_LOBBY'], requiresWarningAcknowledgement: false, seated: 2, seats: 20 })[0]).toBe(
      'This room was cancelled.',
    );
  });

  it('keeps an acknowledgement readable when the lists disagree', () => {
    expect(
      acknowledgementCopy({ local: [], server: ['6 Neutral and Independent seats is above 4 for 20 players.'], loading: false, required: true }).lines,
    ).toEqual(['6 Neutral and Independent seats is above 4 for 20 players.']);
    expect(acknowledgementCopy({ local: [], server: [], loading: false, required: true }).lines).toEqual([
      'This setup has warnings that need acknowledgement.',
    ]);
    expect(acknowledgementCopy({ local: [], server: null, loading: true, required: true }).loading).toBe(true);
  });

  it('names the home return for each room status', () => {
    expect(returnSeatLabel('LOBBY')).toBe('Return to the lobby');
    expect(returnSeatLabel('ACTIVE')).toBe('Return to the game');
    expect(returnSeatLabel('FINISHED')).toBe('See the results');
    expect(returnSeatLabel('CANCELLED')).toBe('See the results');
    expect(returnSeatLabel(null)).toBe('Return to your game');
  });
});

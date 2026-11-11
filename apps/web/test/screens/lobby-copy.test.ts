import { describe, expect, it } from 'vitest';
import { blockerSentence, startSentences } from '../../src/game/components/lobbyCopy';

describe('lobby copy', () => {
  it('names the open seats', () => {
    expect(blockerSentence('SEATS_OPEN', 2, 20)).toBe('Waiting for players. 2 of 20 seats are filled.');
    expect(blockerSentence('SEATS_OVER', 21, 20)).toMatch(/more players/);
    expect(blockerSentence('CONFIG_INVALID', 20, 20)).toMatch(/role setup/);
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

  it('says when a room was cancelled', () => {
    expect(startSentences({ status: 'CANCELLED', ready: false, blockers: ['NOT_LOBBY'], requiresWarningAcknowledgement: false, seated: 2, seats: 20 })[0]).toBe(
      'This room was cancelled.',
    );
  });
});

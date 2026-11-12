import { describe, expect, it } from 'vitest';
import { CHAT_MAX_LENGTH, GAME_PHASES, chatLength, chatRefusal, isChatOpen, normalizeChatBody, type GamePhase } from '../src/index.js';

/** WW-1104: who may post, and what text is stored (OD-72). */

const seat = (phase: GamePhase, overrides: Partial<Parameters<typeof chatRefusal>[0]> = {}) =>
  chatRefusal({ status: 'ACTIVE', phase, lifeStatus: 'ALIVE', muted: false, ...overrides });

describe('chatRefusal', () => {
  it('opens only day discussion and the two ballots', () => {
    const open = GAME_PHASES.filter((phase) => isChatOpen('ACTIVE', phase));
    expect(open).toEqual(['DAY_DISCUSSION', 'VOTING', 'REVOTE']);
  });

  it('is closed at night, on the reveal, at the announcement, and outside a running game', () => {
    for (const phase of ['ROLE_REVEAL', 'NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_ANNOUNCE'] as const) {
      expect(seat(phase)).toBe('CLOSED');
    }
    expect(chatRefusal({ status: 'LOBBY', phase: 'LOBBY', lifeStatus: 'ALIVE', muted: false })).toBe('CLOSED');
    expect(chatRefusal({ status: 'FINISHED', phase: 'FINISHED', lifeStatus: 'ALIVE', muted: false })).toBe('CLOSED');
  });

  it('lets a living, unmuted seat post', () => {
    expect(seat('DAY_DISCUSSION')).toBeNull();
    expect(seat('REVOTE')).toBeNull();
  });

  it('keeps the dead read only and the muted silent', () => {
    expect(seat('VOTING', { lifeStatus: 'DEAD' })).toBe('DEAD');
    expect(seat('VOTING', { muted: true })).toBe('MUTED');
    // A closed chat is reported first: every seat already knows the phase.
    expect(seat('NIGHT_SUBMIT', { lifeStatus: 'DEAD', muted: true })).toBe('CLOSED');
  });
});

describe('normalizeChatBody', () => {
  it('trims and folds line ends', () => {
    expect(normalizeChatBody('  hello\r\nthere  ')).toBe('hello\nthere');
  });

  it('refuses blank text and control characters', () => {
    expect(normalizeChatBody('   \n ')).toBeNull();
    expect(normalizeChatBody('bell\u0007')).toBeNull();
    expect(normalizeChatBody('tab\tok')).toBe('tab\tok');
  });

  it('counts an emoji as one character', () => {
    expect(chatLength('🐺'.repeat(CHAT_MAX_LENGTH))).toBe(CHAT_MAX_LENGTH);
  });
});

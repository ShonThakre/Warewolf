import { describe, expect, it } from 'vitest';
import { checkChatDraft } from '../../src/game/state/chat';
import { chatRefusalCopy, chatRemainingCopy, chatSeatName } from '../../src/game/components/chatCopy';
import { fixtureName, fixturePlayerId } from '../../src/game/fixtures/role';

describe('chat copy', () => {
  it('disables the composer with the server refusal and counts an emoji as one', () => {
    expect(chatRefusalCopy('CLOSED')).toBe('Discussion is closed at night.');
    expect(chatRefusalCopy('CLOSED', 'DAY_ANNOUNCE')).toBe('Discussion will open after you continue to day.');
    expect(chatRefusalCopy('DEAD')).toBe('The dead read only.');
    expect(chatRefusalCopy('MUTED')).toBe('The host muted you.');
    expect(chatRefusalCopy(null)).toBeNull();
    expect(chatRemainingCopy(checkChatDraft('').remaining)).toBe('280 characters left');
    expect(chatRemainingCopy(checkChatDraft('😀').remaining)).toBe('279 characters left');
    expect(checkChatDraft('😀').sendable).toBe(true);
    expect(checkChatDraft('   ').sendable).toBe(false);
    expect(chatRemainingCopy(-1)).toBe('1 character over the limit');
    expect(chatSeatName([{ playerId: fixturePlayerId(2), displayName: fixtureName(2) }], fixturePlayerId(2))).toBe('Rafi');
    expect(chatSeatName([], fixturePlayerId(2))).toBe('A player');
    expect(chatRefusalCopy('CLOSED')).not.toMatch(/wolf|village|villager/i);
  });
});

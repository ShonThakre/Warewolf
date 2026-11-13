import type { GameEvent } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { seenRoles, tableNote } from '../../src/game/components/tableNotes';

const you = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const nameOf = (id: string) => (id === other ? 'Rafi' : 'A player');

function event(type: string, payload: Record<string, unknown>): GameEvent {
  return { seq: 1, type, audience: 'PLAYER', payload };
}

describe('table notes', () => {
  it('reads an investigation in words and drops a host copy about someone else', () => {
    const own = event('INVESTIGATION_RESULT', {
      kind: 'ALIGNMENT_WOLF_OR_NOT',
      targetPlayerIds: [other],
      result: { value: 'WOLF' },
    });
    const host = event('INVESTIGATION_RESULT', {
      actorPlayerId: other,
      kind: 'ALIGNMENT_WOLF_OR_NOT',
      targetPlayerIds: [you],
      result: { value: 'NOT_WOLF' },
    });
    expect(tableNote(own, you, nameOf)).toBe('Rafi is a Wolf.');
    expect(tableNote(host, you, nameOf)).toBeNull();
    expect(
      tableNote(
        event('INVESTIGATION_RESULT', {
          kind: 'ATTACKER_IDS',
          targetPlayerIds: [you],
          result: { value: [other] },
        }),
        you,
        nameOf,
      ),
    ).toBe('Rafi walked into your trap.');
    expect(
      tableNote(event('INVESTIGATION_RESULT', { kind: 'ATTACKER_IDS', targetPlayerIds: [you], result: { value: [] } }), you, nameOf),
    ).toBe('Nobody walked into your trap.');
  });

  it('keeps a conversion and a block that name no one else', () => {
    expect(tableNote(event('ROLE_CONVERTED', { roleId: 'infected_wolf' }), you, nameOf)).toBe('You are now Infected Wolf.');
    expect(tableNote(event('ROLE_CONVERTED', { playerId: other, roleId: 'infected_wolf' }), you, nameOf)).toBeNull();
    expect(tableNote(event('ACTION_BLOCKED', { roundNumber: 1 }), you, nameOf)).toBe('Your action was blocked.');
    expect(tableNote(event('ACTION_BLOCKED', { actorId: other, targetId: you }), you, nameOf)).toBeNull();
    expect(tableNote(event('INFECTION_OCCURRED', { sourcePlayerId: other, roleId: 'infected_wolf' }), you, nameOf)).toBeNull();
  });

  it('reads a published Seeker result to the room, naming the publisher (GAP-01)', () => {
    const published = (publisherPlayerId: string) =>
      event('RESULT_PUBLISHED', { publisherPlayerId, kind: 'ALIGNMENT_WOLF_OR_NOT', targetPlayerIds: [you], result: { value: 'NOT_WOLF' } });
    expect(tableNote(published(other), you, nameOf)).toBe('Rafi published a result: A player is not a Wolf.');
    expect(tableNote(published(you), you, nameOf)).toBe('You published a result: A player is not a Wolf.');
    expect(tableNote(event('RESULT_PUBLISHED', { kind: 'ALIGNMENT_WOLF_OR_NOT', result: { value: 'WOLF' } }), you, nameOf)).toBeNull();
  });

  it('reads the Ultimate 20 outcomes and drops their host copies (GAP-03)', () => {
    const pub = (type: string, payload: Record<string, unknown>): GameEvent => ({ seq: 1, type, audience: 'PUBLIC', payload });
    expect(tableNote(pub('GHOST_HINT', { text: 'Look to the quiet corner.' }), you, nameOf)).toBe('A hint from beyond: “Look to the quiet corner.”');
    expect(tableNote(pub('GHOST_HINT', { text: 'x', actorPlayerId: other }), you, nameOf)).toBeNull();
    expect(tableNote(pub('PLAYER_RETURNED', { playerId: other }), you, nameOf)).toBe('Rafi returned for one night. They cannot vote or use an ability.');
    expect(tableNote(pub('PLAYER_RETURNED', { playerId: you }), you, nameOf)).toBe('You returned for one night. You cannot vote or use an ability.');
    expect(tableNote(event('SILENCED', { roundNumber: 1 }), you, nameOf)).toBe('You are silenced today and cannot post in the discussion.');
    expect(tableNote(event('SILENCED', { playerId: other, actorPlayerId: you }), you, nameOf)).toBeNull();
    expect(tableNote(event('REWIND_RESULT', { cancelled: true }), you, nameOf)).toBe('Your rewind cancelled an action from last night.');
    expect(tableNote(event('ABILITY_COPIED', { targetPlayerIds: [other] }), you, nameOf)).toBe('You copied the ability of Rafi.');
    expect(tableNote(event('CHAOS_EVENT', { kind: 'NO_VOTE' }), you, nameOf)).toBe('Your Chaos event: nobody votes.');
  });

  it('states a public elimination with a catalog name', () => {
    expect(tableNote(event('PLAYER_ELIMINATED', { playerId: other, roleId: 'normal_villager' }), you, nameOf)).toBe('Rafi was eliminated. They were Villager.');
    expect(tableNote(event('PLAYER_ELIMINATED', { playerId: other, roleId: null }), you, nameOf)).toBe('Rafi was eliminated.');
  });
});

describe('seen role cards (PLAY-FIX-01)', () => {
  const card = (actionId: string, extra: Record<string, unknown> = {}) =>
    event('INVESTIGATION_RESULT', { roundNumber: 2, actionId, kind: 'ROLE_ID', targetPlayerIds: [other], result: { value: 'infected_wolf' }, ...extra });

  it('lists the seat own role card once, with the name and role, and words it on the table', () => {
    const own = card('a1');
    expect(seenRoles([own, own], you, nameOf)).toEqual([{ actionId: 'a1', round: 2, playerId: other, displayName: 'Rafi', roleId: 'infected_wolf' }]);
    expect(tableNote(own, you, nameOf)).toBe('Rafi is Infected Wolf.');
  });

  it('leaves out a host copy of someone else, and the Wolf check', () => {
    const hostCopy = card('a2', { actorPlayerId: other });
    const check = event('INVESTIGATION_RESULT', { roundNumber: 1, actionId: 'a3', kind: 'ALIGNMENT_WOLF_OR_NOT', targetPlayerIds: [other], result: { value: 'WOLF' } });
    expect(seenRoles([hostCopy, check], you, nameOf)).toEqual([]);
    expect(seenRoles([card('a4', { actorPlayerId: you })], you, nameOf)).toHaveLength(1);
  });
});

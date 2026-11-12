import type { GameEvent } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { tableNote } from '../../src/game/components/tableNotes';

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
  });

  it('keeps a conversion and a block that name no one else', () => {
    expect(tableNote(event('ROLE_CONVERTED', { roleId: 'infected_wolf' }), you, nameOf)).toBe('You are now Infected Wolf.');
    expect(tableNote(event('ROLE_CONVERTED', { playerId: other, roleId: 'infected_wolf' }), you, nameOf)).toBeNull();
    expect(tableNote(event('ACTION_BLOCKED', { roundNumber: 1 }), you, nameOf)).toBe('Your action was blocked.');
    expect(tableNote(event('ACTION_BLOCKED', { actorId: other, targetId: you }), you, nameOf)).toBeNull();
    expect(tableNote(event('INFECTION_OCCURRED', { sourcePlayerId: other, roleId: 'infected_wolf' }), you, nameOf)).toBeNull();
  });

  it('states a public elimination with a catalog name', () => {
    expect(tableNote(event('PLAYER_ELIMINATED', { playerId: other, roleId: 'normal_villager' }), you, nameOf)).toBe('Rafi was eliminated. They were Villager.');
    expect(tableNote(event('PLAYER_ELIMINATED', { playerId: other, roleId: null }), you, nameOf)).toBe('Rafi was eliminated.');
  });
});

import type { OwnAbility } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { actionRowText, availabilitySentence, choiceReady, promptLabel, seatSelectable } from '../../src/game/components/actionCopy';
import { fixturePlayerId } from '../../src/game/fixtures/role';

const players = { kind: 'PLAYERS' as const, count: 1, life: 'ALIVE' as const, self: false, notSameAsLastRound: false };

function ability(capability: OwnAbility['capability'], target: OwnAbility['target']): Pick<OwnAbility, 'capability' | 'target'> {
  return { capability, target };
}

describe('action copy', () => {
  it('names each capability in a sentence', () => {
    expect(promptLabel(ability('INVESTIGATE', players))).toBe('Choose a player to investigate');
    expect(promptLabel(ability('INVESTIGATE', { ...players, count: 2 }))).toBe('Choose two players to investigate');
    expect(promptLabel(ability('INVESTIGATE', { ...players, life: 'DEAD' }))).toBe('Choose a dead player to investigate');
    expect(promptLabel(ability('PROTECT', { ...players, self: true, notSameAsLastRound: true }))).toBe('Choose a player to protect');
    expect(promptLabel(ability('HEAL', players))).toBe('Save this player');
    expect(promptLabel(ability('HEAL', { kind: 'FINAL_WOLF_TARGET' }))).toBe('Save the announced target');
    expect(promptLabel(ability('POISON', players))).toBe('Choose a player to poison');
    expect(promptLabel(ability('ROLE_REVEAL', { kind: 'OWN_RESULT' }))).toBe('Publish a stored result');
    expect(promptLabel(ability('DETECT', { kind: 'QUESTION', questions: ['WOLF_PACK_SIZE_AT_LEAST'] }))).toBe('Ask the allowed question');
    expect(promptLabel(ability('KILL', players))).toBe('Choose a kill target');
    expect(promptLabel(ability('INFECT', players))).toBe('Choose a player to infect');
  });

  it('gives disabled rows a sentence and hides nothing for an open row', () => {
    expect(availabilitySentence('OPEN')).toBeNull();
    expect(availabilitySentence('PASSIVE')).toBeNull();
    expect(availabilitySentence('NOT_THIS_PHASE')).toBe('Not during this phase.');
    expect(availabilitySentence('NO_USES')).toBe('No uses left.');
    expect(availabilitySentence('COOLDOWN')).toBe('This ability is resting.');
  });

  it('allows a living other player, and a self target only when the rule says so', () => {
    const you = fixturePlayerId(4);
    const alive = { playerId: fixturePlayerId(2), lifeStatus: 'ALIVE' };
    const self = { playerId: you, lifeStatus: 'ALIVE' };
    const dead = { playerId: fixturePlayerId(3), lifeStatus: 'DEAD' };
    expect(seatSelectable(alive, you, players)).toBe(true);
    expect(seatSelectable(self, you, players)).toBe(false);
    expect(seatSelectable(self, you, { ...players, self: true })).toBe(true);
    expect(seatSelectable(dead, you, players)).toBe(false);
    expect(seatSelectable(dead, you, { ...players, life: 'DEAD' })).toBe(true);
    expect(choiceReady(players, [fixturePlayerId(2)], null)).toBe(true);
    expect(choiceReady(players, [], null)).toBe(false);
    expect(choiceReady({ ...players, count: 2 }, [fixturePlayerId(2)], null)).toBe(false);
    expect(choiceReady({ kind: 'FINAL_WOLF_TARGET' }, [], null)).toBe(true);
    expect(choiceReady({ kind: 'QUESTION', questions: ['WOLF_PACK_SIZE_AT_LEAST'] }, [], 'WOLF_PACK_SIZE_AT_LEAST')).toBe(true);
  });

  it('waits out a night with nothing to send', () => {
    expect(actionRowText(true, null, '', false, false)).toBe('Waiting for night to end');
    expect(actionRowText(false, null, '', false, false)).toBeNull();
    expect(actionRowText(true, null, '', false, true)).toBe('Submitted');
  });
});

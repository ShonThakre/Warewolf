import { describe, expect, it } from 'vitest';
import { myActionsFixture } from '../../src/game/fixtures/actions';
import { ROLE_FIXTURES, fixtureName, fixturePlayerId } from '../../src/game/fixtures/role';
import { doctorAttackLine, killRowText, namedByLine } from '../../src/game/components/killCopy';
import { actionPrompts } from '../../src/game/state/actions';

const players = [
  { playerId: fixturePlayerId(1), displayName: fixtureName(1) },
  { playerId: fixturePlayerId(2), displayName: fixtureName(2) },
  { playerId: fixturePlayerId(12), displayName: fixtureName(12) },
];

describe('kill copy', () => {
  it('names the attack and a stored choice without a role', () => {
    expect(killRowText({ editable: true, stored: null, pick: null, name: null })).toBe('Choose the player the pack named, or no kill.');
    expect(killRowText({ editable: true, stored: null, pick: { kind: 'TARGET', playerId: fixturePlayerId(12) }, name: 'Diego' })).toBe('Diego');
    expect(killRowText({ editable: true, stored: { kind: 'NO_KILL' }, pick: { kind: 'NO_KILL' }, name: null })).toContain('Submitted');
    expect(killRowText({ editable: false, stored: { kind: 'TARGET', playerId: fixturePlayerId(12) }, pick: null, name: 'Diego' })).toBe('The attack is on Diego.');
    expect(killRowText({ editable: false, stored: { kind: 'NO_KILL' }, pick: null, name: null })).toBe('There is no attack.');
    expect(namedByLine(players, [fixturePlayerId(1), fixturePlayerId(2)])).toBe('Named by Asha and Rafi');
    const blob = [killRowText({ editable: true, stored: null, pick: null, name: null }), namedByLine(players, [fixturePlayerId(1)])].join(' ');
    expect(blob).not.toContain('alpha_wolf');
    expect(blob).not.toContain('wolf');
  });

  it('reads the informed Doctor target from the save prompt', () => {
    const told = actionPrompts(ROLE_FIXTURES.doctor, myActionsFixture(ROLE_FIXTURES.doctor, { phase: 'NIGHT_REACTION', finalWolfTarget: fixturePlayerId(12) }));
    const spared = actionPrompts(ROLE_FIXTURES.doctor, myActionsFixture(ROLE_FIXTURES.doctor, { phase: 'NIGHT_REACTION', finalWolfTarget: null }));
    const hidden = actionPrompts(ROLE_FIXTURES.doctor, myActionsFixture(ROLE_FIXTURES.doctor, { phase: 'NIGHT_SUBMIT' }));
    expect(doctorAttackLine(told, players)).toBe('The attack is on Diego.');
    expect(doctorAttackLine(spared, players)).toBe('There is no attack.');
    expect(doctorAttackLine(hidden, players)).toBeNull();
    expect(doctorAttackLine(told, players)).not.toContain('Asha');
  });
});

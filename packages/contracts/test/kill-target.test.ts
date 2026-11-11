import { describe, expect, it } from 'vitest';
import { killTargetViewSchema, myActionsSchema, setKillTargetRequestSchema } from '../src/index.js';

const ID = '0f4c6d1e-8b1a-4b7e-9c2a-1d2e3f4a5b6c';
const OTHER = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('set kill target request', () => {
  it('takes one player or no kill, and nothing else', () => {
    expect(setKillTargetRequestSchema.parse({ targetPlayerId: ID })).toEqual({ targetPlayerId: ID });
    expect(setKillTargetRequestSchema.parse({ noKill: true })).toEqual({ noKill: true });
    expect(setKillTargetRequestSchema.safeParse({ noKill: false }).success).toBe(false);
    expect(setKillTargetRequestSchema.safeParse({ targetPlayerId: ID, noKill: true }).success).toBe(false);
    expect(setKillTargetRequestSchema.safeParse({ targetPlayerId: 'Rafi' }).success).toBe(false);
    expect(setKillTargetRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('kill target view', () => {
  it('carries the candidates and the decision', () => {
    const view = {
      gameId: ID,
      phase: 'NIGHT_HOST_CONFIRM',
      roundNumber: 1,
      candidates: [{ playerId: OTHER, submittedBy: [ID] }],
      decision: { kind: 'TARGET', playerId: OTHER },
      editable: true,
    };
    expect(killTargetViewSchema.parse(view)).toEqual(view);
    expect(killTargetViewSchema.parse({ ...view, decision: { kind: 'NO_KILL' } }).decision).toEqual({ kind: 'NO_KILL' });
    expect(killTargetViewSchema.safeParse({ ...view, decision: { kind: 'TARGET' } }).success).toBe(false);
  });
});

describe('the informed Doctor\'s target on my actions', () => {
  it('is optional, and null means no attack', () => {
    const row = { abilityInstanceId: ID, abilityId: 'doctor_save', availability: 'OPEN', action: null };
    const view = (extra: object) => ({ gameId: ID, phase: 'NIGHT_REACTION', roundNumber: 1, abilities: [{ ...row, ...extra }] });
    expect(myActionsSchema.parse(view({})).abilities[0]).not.toHaveProperty('finalWolfTarget');
    expect(myActionsSchema.parse(view({ finalWolfTarget: OTHER })).abilities[0]?.finalWolfTarget).toBe(OTHER);
    expect(myActionsSchema.parse(view({ finalWolfTarget: null })).abilities[0]?.finalWolfTarget).toBeNull();
  });
});

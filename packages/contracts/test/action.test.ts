import { describe, expect, it } from 'vitest';
import { idempotencyKeySchema, myActionsSchema, submitActionRequestSchema } from '../src/index.js';

const ID = '0f4c6d1e-8b1a-4b7e-9c2a-1d2e3f4a5b6c';

describe('submit action request', () => {
  it('defaults to no targets and no payload', () => {
    expect(submitActionRequestSchema.parse({ abilityInstanceId: ID })).toEqual({ abilityInstanceId: ID, targetPlayerIds: [], payload: {} });
  });

  it('is strict, so a client cannot choose the round or claim a result', () => {
    expect(submitActionRequestSchema.safeParse({ abilityInstanceId: ID, roundNumber: 3 }).success).toBe(false);
    expect(submitActionRequestSchema.safeParse({ abilityInstanceId: ID, result: 'WOLF' }).success).toBe(false);
  });

  it('takes only uuids as targets, and flat payload values', () => {
    expect(submitActionRequestSchema.safeParse({ abilityInstanceId: ID, targetPlayerIds: ['Rafi'] }).success).toBe(false);
    expect(submitActionRequestSchema.safeParse({ abilityInstanceId: ID, payload: { question: { nested: true } } }).success).toBe(false);
    expect(submitActionRequestSchema.safeParse({ abilityInstanceId: ID, payload: { question: 'WOLF_PACK_SIZE_AT_LEAST' } }).success).toBe(true);
  });
});

describe('idempotency key', () => {
  it('accepts a uuid and rejects short or odd keys', () => {
    expect(idempotencyKeySchema.safeParse(ID).success).toBe(true);
    expect(idempotencyKeySchema.safeParse('abc').success).toBe(false);
    expect(idempotencyKeySchema.safeParse('has spaces in it').success).toBe(false);
  });
});

describe('my actions', () => {
  it('lists each ability with its availability and current choice', () => {
    const view = {
      gameId: ID,
      phase: 'NIGHT_SUBMIT',
      roundNumber: 2,
      abilities: [
        { abilityInstanceId: ID, abilityId: 'guard_protect', availability: 'OPEN', action: null },
        { abilityInstanceId: ID, abilityId: 'witch_poison', availability: 'NO_USES', action: null },
      ],
    };
    expect(myActionsSchema.parse(view)).toEqual(view);
    expect(myActionsSchema.safeParse({ ...view, abilities: [{ ...view.abilities[0], availability: 'MAYBE' }] }).success).toBe(false);
  });
});

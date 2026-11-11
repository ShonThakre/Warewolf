import { DEFAULT_CATALOG } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, myRoleSchema, startGameRequestSchema, targetRuleSchema, type MyRole } from '../src/index.js';

describe('start request', () => {
  it('defaults to not acknowledging warnings', () => {
    expect(startGameRequestSchema.parse({})).toEqual({ acknowledgeWarnings: false });
    expect(startGameRequestSchema.parse({ acknowledgeWarnings: true })).toEqual({ acknowledgeWarnings: true });
  });

  it('rejects a client-supplied seed or any other unknown key', () => {
    expect(startGameRequestSchema.safeParse({ seed: 42 }).success).toBe(false);
    expect(startGameRequestSchema.safeParse({ acknowledgeWarnings: true, order: [1, 2] }).success).toBe(false);
    expect(startGameRequestSchema.safeParse({ acknowledgeWarnings: 'yes' }).success).toBe(false);
  });
});

describe('target rules', () => {
  const abilities = DEFAULT_CATALOG.roles.flatMap((r) => Object.values(r.profiles).flatMap((p) => p.abilities));

  it.each(abilities.map((a) => [a.id, a.target] as const))('the contract accepts the catalog target of %s', (_id, target) => {
    expect(targetRuleSchema.parse(target)).toEqual(target);
  });
});

describe('own role projection', () => {
  const me: MyRole = {
    gameId: '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31',
    playerId: '5c1d0e77-1a2b-4c3d-8e9f-001122334455',
    displayName: 'Rafi',
    seatNumber: 4,
    lifeStatus: 'ALIVE',
    originalRole: { id: 'seeker', profileId: 'seeker', name: 'Seeker', faction: 'VILLAGE' },
    currentRole: { id: 'seeker', profileId: 'seeker', name: 'Seeker', faction: 'VILLAGE' },
    abilities: [],
    teammatesVisible: false,
    teammates: [],
  };

  it('drops fields the contract does not name, so a server slip cannot reach the screen', () => {
    const parsed = myRoleSchema.parse({ ...me, roster: [{ roleId: 'alpha_wolf' }] });
    expect(parsed).toEqual(me);
    expect(JSON.stringify(parsed)).not.toContain('alpha_wolf');
  });
});

describe('error codes', () => {
  it('include the start refusals', () => {
    expect(ERROR_CODES).toEqual(expect.arrayContaining(['SEAT_COUNT_MISMATCH', 'WARNINGS_UNACKNOWLEDGED', 'CONFIG_INVALID']));
  });
});

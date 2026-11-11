import { ROLE_PACKS } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_COUNT,
  ROOM_CODE_ALPHABET,
  avatarIdSchema,
  changeAvatarRequestSchema,
  createGameRequestSchema,
  displayNameSchema,
  gameConfigurationSchema,
  joinGameRequestSchema,
  parseGameConfiguration,
  roomCodeSchema,
} from '../src/index.js';

describe('display names (OD-66)', () => {
  it('trims and accepts 2 to 24 characters', () => {
    expect(displayNameSchema.parse('  Asha  ')).toBe('Asha');
    expect(displayNameSchema.parse('Zoë the Wise')).toBe('Zoë the Wise');
    expect(displayNameSchema.safeParse('A').success).toBe(false);
    expect(displayNameSchema.safeParse('x'.repeat(25)).success).toBe(false);
    expect(displayNameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects control characters', () => {
    expect(displayNameSchema.safeParse('Bad\u0000Name').success).toBe(false);
    expect(displayNameSchema.safeParse('Tab\tName').success).toBe(false);
  });
});

describe('room codes', () => {
  it('excludes look-alike characters', () => {
    for (const ch of 'IL01O') expect(ROOM_CODE_ALPHABET).not.toContain(ch);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });

  it('normalizes case and whitespace', () => {
    expect(roomCodeSchema.parse(' k7qmpr ')).toBe('K7QMPR');
    expect(roomCodeSchema.safeParse('K7QMP').success).toBe(false);
    expect(roomCodeSchema.safeParse('K7QMP0').success).toBe(false);
  });
});

describe('avatars', () => {
  it('accepts 1 to 36', () => {
    expect(avatarIdSchema.parse(1)).toBe(1);
    expect(avatarIdSchema.parse(AVATAR_COUNT)).toBe(36);
    for (const bad of [0, 37, 1.5, '3']) expect(avatarIdSchema.safeParse(bad).success).toBe(false);
  });

  it('is optional on create and join', () => {
    expect(joinGameRequestSchema.parse({ roomCode: 'K7QMPR', displayName: 'Rafi', avatarId: 7 }).avatarId).toBe(7);
    expect(createGameRequestSchema.safeParse({ displayName: 'Asha', avatarId: 99 }).success).toBe(false);
    expect(changeAvatarRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('lobby requests', () => {
  it('defaults the mode to Infection Edition', () => {
    expect(createGameRequestSchema.parse({ displayName: 'Asha' })).toEqual({ displayName: 'Asha', mode: 'INFECTION' });
    expect(createGameRequestSchema.safeParse({ displayName: 'Asha', mode: 'BATTLE' }).success).toBe(false);
  });

  it('parses a join request', () => {
    expect(joinGameRequestSchema.parse({ roomCode: 'k7qmpr', displayName: ' Rafi ' })).toEqual({ roomCode: 'K7QMPR', displayName: 'Rafi' });
  });
});

describe('configuration schema', () => {
  it.each(ROLE_PACKS.map((p) => [p.id, p.config] as const))('round-trips the %s pack unchanged', (_id, config) => {
    expect(parseGameConfiguration(JSON.parse(JSON.stringify(config)))).toEqual(config);
  });

  it('rejects unknown keys, so the domain type and schema cannot drift silently', () => {
    const config = { ...JSON.parse(JSON.stringify(ROLE_PACKS[0]!.config)), surprise: true };
    expect(gameConfigurationSchema.safeParse(config).success).toBe(false);
  });

  it('accepts a structurally valid but unplayable draft', () => {
    const config = JSON.parse(JSON.stringify(ROLE_PACKS[0]!.config));
    config.roles = [{ roleId: 'priest', count: 99 }];
    expect(gameConfigurationSchema.safeParse(config).success).toBe(true);
  });
});

import { ROOM_CODE_ALPHABET, roomCodeSchema } from '@warewolf/contracts';
import { getPack, validateConfiguration } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import { hashToken, newSeatToken } from '../src/auth/seat.js';
import { generateRoomCode, startState } from '../src/lobby/lobby.service.js';

describe('generateRoomCode', () => {
  it('uses only the unambiguous alphabet', () => {
    let i = 0;
    const cycle = (max: number) => i++ % max;
    const codes = Array.from({ length: 20 }, () => generateRoomCode(cycle));
    for (const code of codes) {
      expect(code).toHaveLength(6);
      expect(roomCodeSchema.parse(code)).toBe(code);
    }
    expect(new Set(codes.join(''))).toEqual(new Set(ROOM_CODE_ALPHABET));
  });

  it('produces valid codes from the real random source', () => {
    for (let n = 0; n < 200; n++) expect(roomCodeSchema.safeParse(generateRoomCode()).success).toBe(true);
  });
});

describe('seat tokens', () => {
  it('are long, random, and hashed with SHA-256', () => {
    const a = newSeatToken();
    const b = newSeatToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^ww_[A-Za-z0-9_-]{43}$/);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });
});

describe('startState', () => {
  const classic = getPack('classic-10')!.config;
  const valid = validateConfiguration(classic);

  it('is ready with every seat taken and a valid draft', () => {
    expect(startState('LOBBY', 10, classic, valid)).toEqual({ ready: true, blockers: [], requiresWarningAcknowledgement: true });
  });

  it('lists every blocker', () => {
    expect(startState('LOBBY', 4, classic, valid).blockers).toEqual(['SEATS_OPEN']);
    expect(startState('LOBBY', 11, classic, valid).blockers).toEqual(['SEATS_OVER']);
    const invalid = validateConfiguration({ ...classic, playerCount: 11 });
    expect(startState('CANCELLED', 10, classic, invalid).blockers).toEqual(['NOT_LOBBY', 'CONFIG_INVALID']);
  });
});

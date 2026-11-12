import { describe, expect, it } from 'vitest';
import { closePhaseRequestSchema, gameStateSchema, type GameState } from '../src/index.js';

const state: GameState = {
  gameId: '0f4c6d1e-8b1a-4b7e-9c2a-1d2e3f4a5b6c',
  status: 'ACTIVE',
  phase: 'NIGHT_SUBMIT',
  roundNumber: 1,
  stateVersion: 21,
  pacing: 'TIMED',
  phaseStartedAt: '2026-11-11T20:00:00.000Z',
  phaseEndsAt: '2026-11-11T20:01:30.000Z',
  serverNow: '2026-11-11T20:00:05.000Z',
  close: { next: null, resolves: 'NIGHT' },
  voting: { abstain: true, changeUntilClose: true },
  players: [
    {
      playerId: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
      displayName: 'Rafi',
      seatNumber: 1,
      avatarId: 4,
      isHost: true,
      lifeStatus: 'ALIVE',
    },
  ],
  you: { playerId: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d', isHost: true, lifeStatus: 'ALIVE' },
};

describe('game state', () => {
  it('accepts a timed night', () => {
    expect(gameStateSchema.parse(state)).toEqual(state);
  });

  it('accepts a host-paced phase with no deadline, and an end state with no close', () => {
    expect(gameStateSchema.safeParse({ ...state, pacing: 'HOST', phaseEndsAt: null }).success).toBe(true);
    expect(gameStateSchema.safeParse({ ...state, status: 'FINISHED', phase: 'FINISHED', close: null }).success).toBe(true);
  });

  it('drops anything the contract does not name, such as a role', () => {
    const leaked = { ...state, players: [{ ...state.players[0], currentRoleId: 'alpha_wolf' }], hostOnly: true };
    const parsed = gameStateSchema.parse(leaked);
    expect(parsed.players[0]).not.toHaveProperty('currentRoleId');
    expect(parsed).not.toHaveProperty('hostOnly');
  });

  it('requires ISO timestamps', () => {
    expect(gameStateSchema.safeParse({ ...state, phaseEndsAt: 'in 90 seconds' }).success).toBe(false);
  });

  it('publishes only the two ballot booleans', () => {
    const parsed = gameStateSchema.parse({ ...state, voting: { abstain: false, changeUntilClose: false, enabled: true, deadMayVote: true } });
    expect(parsed.voting).toEqual({ abstain: false, changeUntilClose: false });
    expect(gameStateSchema.safeParse({ ...state, voting: { abstain: false } }).success).toBe(false);
    expect(gameStateSchema.safeParse({ ...state, voting: undefined }).success).toBe(false);
  });
});

describe('close phase request', () => {
  it('needs the state version the host saw', () => {
    expect(closePhaseRequestSchema.parse({ stateVersion: 21 })).toEqual({ stateVersion: 21 });
    expect(closePhaseRequestSchema.safeParse({}).success).toBe(false);
    expect(closePhaseRequestSchema.safeParse({ stateVersion: -1 }).success).toBe(false);
  });

  it('is strict, so a client cannot name the phase to jump to', () => {
    expect(closePhaseRequestSchema.safeParse({ stateVersion: 21, phase: 'FINISHED' }).success).toBe(false);
  });
});

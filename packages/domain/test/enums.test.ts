import { describe, expect, it } from 'vitest';
import {
  ABILITY_SOURCES,
  ABILITY_STATUSES,
  CAPABILITIES,
  CONNECTION_STATUSES,
  FACTIONS,
  GAME_MODES,
  GAME_PHASES,
  GAME_STATUSES,
  INDIVIDUAL_VICTORY_STATES,
  INFECTION_BEHAVIORS,
  IMPLEMENTATION_STATUSES,
  LIFE_STATUSES,
  type GameSnapshot,
} from '../src/index.js';

const all = {
  ABILITY_SOURCES,
  ABILITY_STATUSES,
  CAPABILITIES,
  CONNECTION_STATUSES,
  FACTIONS,
  GAME_MODES,
  GAME_PHASES,
  GAME_STATUSES,
  INDIVIDUAL_VICTORY_STATES,
  INFECTION_BEHAVIORS,
  IMPLEMENTATION_STATUSES,
  LIFE_STATUSES,
};

describe('domain enumerations', () => {
  it.each(Object.entries(all))('%s has unique upper-snake values', (_name, values) => {
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it('has the four factions from the role catalog', () => {
    expect(FACTIONS).toEqual(['VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT']);
  });

  it('has the modes from the role configuration document', () => {
    expect(GAME_MODES).toEqual(['INFECTION', 'CLASSIC', 'EXPANDED', 'CUSTOM', 'ULTIMATE_20']);
  });

  it('has the phases from the data model, starting in the lobby', () => {
    expect(GAME_PHASES).toHaveLength(11);
    expect(GAME_PHASES[0]).toBe('LOBBY');
    expect(GAME_PHASES).toContain('NIGHT_HOST_CONFIRM');
    expect(GAME_PHASES).toContain('NIGHT_REACTION');
  });

  it('has the 17 capabilities from the role catalog', () => {
    expect(CAPABILITIES).toHaveLength(23);
  });
});

describe('GameSnapshot', () => {
  it('describes a lobby game as plain data', () => {
    const lobby: GameSnapshot = {
      gameId: 'g1',
      status: 'LOBBY',
      phase: 'LOBBY',
      mode: 'INFECTION',
      roundNumber: 0,
      stateVersion: 0,
      hostPlayerId: 'p1',
      catalogHash: null,
      players: [
        {
          id: 'p1',
          displayName: 'Asha',
          seatNumber: 1,
          isHost: true,
          lifeStatus: 'ALIVE',
          connectionStatus: 'CONNECTED',
          diedRound: null,
        },
      ],
      assignments: [],
      abilities: [],
    };
    expect(structuredClone(lobby)).toEqual(lobby);
  });
});

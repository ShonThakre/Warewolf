import type { LobbyPlayer, LobbyProjection } from '@warewolf/contracts';
import type { GamePhase, GameStatus, LifeStatus } from '@warewolf/domain';
import { FIXTURE_GAME_ID, fixtureName, fixturePlayerId } from './role';

/**
 * Lobby and table fixtures (WEB-02). Same game id, seat ids, and names as the
 * role fixtures, so a screen can combine them. Shaped like GET /games/:gameId,
 * the lobby projection, which is the API example these come from.
 */

export const FIXTURE_ROOM_CODE = 'K7QMPR';

export interface LobbyFixtureOptions {
  /** Seats taken, from seat 1. Defaults to every seat. */
  readonly seated?: number;
  readonly status?: GameStatus;
  readonly phase?: GamePhase;
  /** The viewer's seat. Seat 1 is the host. */
  readonly you?: number;
}

/** An Infection Edition room of 20 seats. */
export function lobbyFixture(options: LobbyFixtureOptions = {}): LobbyProjection {
  const playerCount = 20;
  const seated = options.seated ?? playerCount;
  const you = options.you ?? 1;
  const status = options.status ?? 'LOBBY';
  const players: LobbyPlayer[] = Array.from({ length: seated }, (_, i) => ({
    playerId: fixturePlayerId(i + 1),
    displayName: fixtureName(i + 1),
    seatNumber: i + 1,
    avatarId: i + 1,
    isHost: i === 0,
    connectionStatus: 'CONNECTED',
  }));
  const full = seated === playerCount;
  const blockers: LobbyProjection['start']['blockers'] = [
    ...(status === 'LOBBY' ? [] : (['NOT_LOBBY'] as const)),
    ...(full ? [] : (['SEATS_OPEN'] as const)),
  ];
  return {
    gameId: FIXTURE_GAME_ID,
    roomCode: FIXTURE_ROOM_CODE,
    status,
    phase: options.phase ?? (status === 'LOBBY' ? 'LOBBY' : 'ROLE_REVEAL'),
    mode: 'INFECTION',
    rolePackId: 'infection-core',
    playerCount,
    hostPlayerId: fixturePlayerId(1),
    stateVersion: seated,
    players,
    you: { playerId: fixturePlayerId(you), isHost: you === 1 },
    configuration: {
      valid: true,
      errorCount: 0,
      warningCount: 0,
      summary: {
        playerCount,
        selectedSeats: playerCount,
        remainingSeats: 0,
        factions: { VILLAGE: 19, WOLF_PACK: 1, NEUTRAL: 0, INDEPENDENT: 0 },
        startingPack: 1,
        wolfCap: 5,
        infectionSuccesses: 4,
      },
    },
    start: { ready: blockers.length === 0, blockers, requiresWarningAcknowledgement: false },
  };
}

/**
 * A public seat at the table: what every member may see. Until the public
 * game projection exists (Phase 5), this is the lobby seat plus life status.
 */
export interface TableSeat extends Pick<LobbyPlayer, 'playerId' | 'displayName' | 'seatNumber' | 'avatarId' | 'isHost'> {
  readonly lifeStatus: LifeStatus;
}

/** The 20 seats mid-game: seats 6 and 13 are dead, so screens can show dead seats that are not targets. */
export function tableSeatsFixture(dead: readonly number[] = [6, 13]): TableSeat[] {
  return lobbyFixture().players.map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    seatNumber: p.seatNumber,
    avatarId: p.avatarId,
    isHost: p.isHost,
    lifeStatus: dead.includes(p.seatNumber) ? 'DEAD' : 'ALIVE',
  }));
}

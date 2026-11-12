import type { GameState, PhaseClose } from '@warewolf/contracts';
import type { GamePhase, LifeStatus } from '@warewolf/domain';
import { FIXTURE_GAME_ID, fixtureName, fixturePlayerId } from './role';

/**
 * Game state fixtures (Phase 5), shaped like GET /games/:gameId/state. Same
 * game id, seat ids, and names as the lobby and role fixtures.
 */

/** The server clock in every fixture. A timed phase ends `secondsLeft` after it. */
export const FIXTURE_SERVER_NOW = '2026-11-11T20:00:00.000Z';

/** What the host's close does in each phase of Infection Edition (host confirm and Doctor reaction on). */
export const INFECTION_CLOSES: Readonly<Record<GamePhase, PhaseClose | null>> = {
  LOBBY: null,
  ROLE_REVEAL: { next: 'NIGHT_SUBMIT', resolves: null },
  NIGHT_SUBMIT: { next: 'NIGHT_HOST_CONFIRM', resolves: null },
  NIGHT_HOST_CONFIRM: { next: 'NIGHT_REACTION', resolves: null },
  NIGHT_REACTION: { next: null, resolves: 'NIGHT' },
  DAY_ANNOUNCE: { next: 'DAY_DISCUSSION', resolves: null },
  DAY_DISCUSSION: { next: 'VOTING', resolves: null },
  VOTING: { next: null, resolves: 'DAY' },
  REVOTE: { next: null, resolves: 'DAY' },
  FINISHED: null,
  CANCELLED: null,
};

export interface GameStateFixtureOptions {
  readonly phase?: GamePhase;
  readonly roundNumber?: number;
  /** The viewer's seat. Seat 1 is the host. */
  readonly you?: number;
  /** Seats that are dead. */
  readonly dead?: readonly number[];
  /** Makes the phase timed, ending this many seconds after `FIXTURE_SERVER_NOW`. */
  readonly secondsLeft?: number;
  /** Ballot rules. Both default to allowed, matching the preset packs. */
  readonly voting?: { readonly abstain?: boolean; readonly changeUntilClose?: boolean };
}

/** A 20-seat Infection Edition game. Host-paced unless `secondsLeft` is given. */
export function gameStateFixture(options: GameStateFixtureOptions = {}): GameState {
  const phase = options.phase ?? 'NIGHT_SUBMIT';
  const you = options.you ?? 1;
  const dead = new Set(options.dead ?? []);
  const life = (seat: number): LifeStatus => (dead.has(seat) ? 'DEAD' : 'ALIVE');
  const status = phase === 'LOBBY' ? 'LOBBY' : phase === 'FINISHED' ? 'FINISHED' : phase === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE';
  const timed = options.secondsLeft !== undefined;

  return {
    gameId: FIXTURE_GAME_ID,
    status,
    phase,
    roundNumber: options.roundNumber ?? (status === 'LOBBY' ? 0 : 1),
    stateVersion: 30,
    pacing: timed ? 'TIMED' : 'HOST',
    phaseStartedAt: FIXTURE_SERVER_NOW,
    phaseEndsAt: timed ? new Date(Date.parse(FIXTURE_SERVER_NOW) + options.secondsLeft! * 1000).toISOString() : null,
    serverNow: FIXTURE_SERVER_NOW,
    close: INFECTION_CLOSES[phase],
    voting: {
      abstain: options.voting?.abstain ?? true,
      changeUntilClose: options.voting?.changeUntilClose ?? true,
    },
    players: Array.from({ length: 20 }, (_, i) => ({
      playerId: fixturePlayerId(i + 1),
      displayName: fixtureName(i + 1),
      seatNumber: i + 1,
      avatarId: i + 1,
      isHost: i === 0,
      lifeStatus: life(i + 1),
    })),
    you: { playerId: fixturePlayerId(you), isHost: you === 1, lifeStatus: life(you) },
  };
}

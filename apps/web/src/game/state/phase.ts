import { skipToken } from '@reduxjs/toolkit/query/react';
import type { GameState } from '@warewolf/contracts';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { gameApi, useClosePhaseMutation, useGetGameStateQuery } from '../../api/game';
import { useAppSelector } from '../../app/hooks';
import { useSeat } from './lobby';

/**
 * Hooks for the phase machine (Phase 5): the phase banner, the countdown, and
 * the host's close button. Polling stands in for realtime events until
 * Phase 11. Screens never fetch the state themselves.
 */

/** How often a seat asks for the state while a game runs. */
export const GAME_STATE_POLL_MS = 2000;

export interface GameStateView {
  /** Null until the first response, and when the caller has no seat. */
  readonly state: GameState | null;
  /**
   * Server clock minus device clock, in milliseconds, measured when the state
   * arrived. `secondsLeft` uses it so a phone with a wrong clock still counts
   * down to the server's deadline.
   */
  readonly clockOffsetMs: number;
  readonly isLoading: boolean;
  /** Normalized error. A 401 also clears the seat. */
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/**
 * The game's phase, round, deadline, and public seats, polled every
 * `GAME_STATE_POLL_MS` while the tab is focused. Polling stops once the game
 * is finished or cancelled.
 */
export function useGameState(): GameStateView {
  const seat = useSeat();
  const gameId = seat?.gameId;
  const cachedStatus = useAppSelector((s) => (gameId ? gameApi.endpoints.getGameState.select(gameId)(s).data?.status : undefined));
  const ended = cachedStatus === 'FINISHED' || cachedStatus === 'CANCELLED';
  const query = useGetGameStateQuery(gameId ?? skipToken, {
    pollingInterval: ended ? 0 : GAME_STATE_POLL_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });

  const state = seat ? (query.data ?? null) : null;
  return {
    state,
    clockOffsetMs: state && query.fulfilledTimeStamp ? clockOffset(state.serverNow, query.fulfilledTimeStamp) : 0,
    isLoading: query.isLoading,
    error: apiErrorOf(query.error),
    refetch: () => void query.refetch(),
  };
}

/** Server clock minus device clock, from a response's `serverNow` and the device time it arrived. */
export function clockOffset(serverNow: string, receivedAtMs: number): number {
  return Date.parse(serverNow) - receivedAtMs;
}

/**
 * Whole seconds until the phase closes by itself, never below 0. Null when
 * the phase has no deadline: host-paced games, and the phases that wait for
 * the host in every game. A deadline reaching 0 does not change the phase on
 * this device; the next state does.
 */
export function secondsLeft(phaseEndsAt: string | null, clockOffsetMs: number, deviceNowMs: number): number | null {
  if (!phaseEndsAt) return null;
  const remaining = Date.parse(phaseEndsAt) - (deviceNowMs + clockOffsetMs);
  return Math.max(0, Math.ceil(remaining / 1000));
}

/** `secondsLeft`, re-rendered every `tickMs` while a deadline is set. For `CountdownTimer`. */
export function useSecondsLeft(view: Pick<GameStateView, 'state' | 'clockOffsetMs'>, tickMs = 250): number | null {
  const phaseEndsAt = view.state?.phaseEndsAt ?? null;
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  useEffect(() => {
    if (!phaseEndsAt) return undefined;
    setDeviceNow(Date.now());
    const timer = setInterval(() => setDeviceNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [phaseEndsAt, tickMs]);
  return secondsLeft(phaseEndsAt, view.clockOffsetMs, deviceNow);
}

export interface ClosePhaseControl {
  /** True for the host while the current phase can be closed. */
  readonly canClose: boolean;
  /** What the close does, for the button label. Null when it cannot close. */
  readonly close: GameState['close'];
  readonly isClosing: boolean;
  /** PHASE_CONFLICT means the screen was stale; the state has already refetched. */
  readonly error: ApiErrorInfo | null;
  /** Closes the phase the screen shows. Resolves to the new state, or null when refused. */
  readonly closePhase: () => Promise<GameState | null>;
}

/**
 * The host's close button. It sends the `stateVersion` of the state it was
 * given, so a stale screen or a double click is refused instead of closing
 * two phases.
 */
export function useClosePhase(state: GameState | null): ClosePhaseControl {
  const [trigger, result] = useClosePhaseMutation();
  const canClose = Boolean(state?.you.isHost && state.status === 'ACTIVE' && state.close);

  const closePhase = useCallback(async () => {
    if (!state || !canClose) return null;
    const outcome = await trigger({ gameId: state.gameId, stateVersion: state.stateVersion });
    return 'data' in outcome && outcome.data ? outcome.data : null;
  }, [state, canClose, trigger]);

  return {
    canClose,
    close: canClose ? (state?.close ?? null) : null,
    isClosing: result.isLoading,
    error: apiErrorOf(result.error),
    closePhase,
  };
}

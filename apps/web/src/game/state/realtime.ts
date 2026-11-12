import { useEffect } from 'react';
import { subscribePlay } from '../../realtime/session';
import { useSeat } from './lobby';

/**
 * Keeps the table on the server's phase (WW-1103). A `PHASE_CHANGED` event
 * asks the caller to read `GET /state` again, so two browsers move together
 * instead of waiting for the poll. The poll stays as the fallback when the
 * socket is down.
 *
 * The connection is the seat's shared `/play` session (WEB-09), which also
 * carries chat. It joins the game's rooms and replays missed stored events.
 */

/** Calls `onPhase` when the public phase signal arrives. Null skips the subscription. */
export function usePlaySession(onPhase: (() => void) | null): void {
  const seat = useSeat();
  const gameId = seat?.gameId;
  const token = seat?.token;

  useEffect(() => {
    if (!gameId || !token || !onPhase) return;
    return subscribePlay(token, gameId, { PHASE_CHANGED: () => onPhase() });
  }, [gameId, token, onPhase]);
}

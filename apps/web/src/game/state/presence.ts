import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../../api/api';
import { isPlayConnected, subscribePlay } from '../../realtime/session';
import { revoked, type RevokedReason } from '../../session/sessionSlice';
import { useSeat } from './lobby';

/**
 * Stored event types that change the game log (LOG-01). Each arrival marks the
 * log stale, so it refetches while open. A module constant, so the
 * subscription stays stable.
 */
export const LOG_EVENT_TYPES = [
  'ROOM_CREATED',
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'PLAYER_KICKED',
  'HOST_CHANGED',
  'GAME_STARTED',
  'GAME_CANCELLED',
  'GAME_FINISHED',
  'PLAYER_DISCONNECTED',
  'PLAYER_RECONNECTED',
  'SEAT_RECLAIMED',
  'PHASE_CHANGED',
  'PLAYER_ELIMINATED',
  'DAY_ELIMINATED',
  'VOTE_TALLY',
  'RESULT_PUBLISHED',
  'GHOST_HINT',
  'PLAYER_RETURNED',
  'INVESTIGATION_RESULT',
  'INFECTION_OCCURRED',
  'ROLE_CONVERTED',
  'VAMPIRE_TEAM_JOIN',
  'ACTION_BLOCKED',
  'SILENCED',
  'REWIND_RESULT',
  'ABILITY_COPIED',
  'CHAOS_EVENT',
] as const;

export type ConnectionState = 'connecting' | 'online' | 'reconnecting';

/**
 * ID-01, ID-02, LOG-01: keeps this seat live while a game screen is open.
 *
 * - Opens (or shares) the seat's `/play` connection, which is what tells the
 *   server the player is here.
 * - Reports the connection state for the status bar.
 * - A `SEAT_REVOKED` from the server (seat opened on another device, or
 *   removed by the host) ends the session on this device.
 * - Any stored event marks the game log stale.
 */
export function useLiveSeat(): ConnectionState {
  const seat = useSeat();
  const dispatch = useDispatch();
  const gameId = seat?.gameId;
  const token = seat?.token;
  const [state, setState] = useState<ConnectionState>(() => (token && isPlayConnected(token) ? 'online' : 'connecting'));

  useEffect(() => {
    if (!gameId || !token) return;
    setState(isPlayConnected(token) ? 'online' : 'connecting');
    const stale = () => {
      dispatch(api.util.invalidateTags([{ type: 'GameLog', id: gameId }, { type: 'GameLog', id: `host:${gameId}` }]));
    };
    return subscribePlay(token, gameId, {
      connect: () => {
        setState('online');
        // Missed events are replayed on join, but presence and lobby rows written while away are cheaper to refetch.
        stale();
      },
      disconnect: () => setState('reconnecting'),
      connect_error: () => setState('reconnecting'),
      SEAT_REVOKED: (body) => {
        const reason = (body as { reason?: unknown } | null)?.reason;
        dispatch(revoked(reason === 'KICKED' ? 'KICKED' : ('SEAT_RECLAIMED' satisfies RevokedReason)));
      },
      ...Object.fromEntries(LOG_EVENT_TYPES.map((type) => [type, stale])),
    });
  }, [gameId, token, dispatch]);

  return state;
}

/**
 * The state to show: "reconnecting" only after it has lasted `delayMs`, so a
 * blip or a reload never flashes a warning.
 */
export function useShownConnection(state: ConnectionState, delayMs = 2000): 'online' | 'reconnecting' {
  const [shown, setShown] = useState<'online' | 'reconnecting'>('online');
  useEffect(() => {
    if (state !== 'reconnecting') {
      setShown('online');
      return;
    }
    const timer = setTimeout(() => setShown('reconnecting'), delayMs);
    return () => clearTimeout(timer);
  }, [state, delayMs]);
  return shown;
}

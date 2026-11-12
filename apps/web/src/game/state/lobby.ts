import { skipToken } from '@reduxjs/toolkit/query/react';
import type { LobbyProjection, SeatCredentials } from '@warewolf/contracts';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { LOBBY_POLL_MS, lobbyApi, useGetLobbyQuery } from '../../api/lobby';
import { useAppSelector } from '../../app/hooks';
import { selectCredentials } from '../../session/sessionSlice';

/**
 * Hooks the lobby screens use. They hide RTK Query details so screens only
 * deal with data, loading, and a normalized error.
 *
 * Mutations (create, join, leave, kick, transfer, cancel, save configuration)
 * are the RTK hooks exported from `src/api/lobby.ts`. Read their errors with
 * `apiErrorOf(result.error)`.
 */

/** The caller's seat, or null when they have not joined a game in this tab. */
export function useSeat(): SeatCredentials | null {
  return useAppSelector(selectCredentials);
}

export interface LobbyState {
  /** Null until the first response, and when the caller has no seat. */
  readonly lobby: LobbyProjection | null;
  readonly isLoading: boolean;
  /** Normalized error. A 401 also clears the seat, so `useSeat()` becomes null. */
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/**
 * The current lobby, polled every `LOBBY_POLL_MS` while the tab is focused.
 * Polling stops once the game leaves the lobby. Realtime keeps the table current after start.
 */
export function useLobby(): LobbyState {
  const seat = useSeat();
  const gameId = seat?.gameId;
  // Read the cached status first so the poll can stop once the game leaves the lobby.
  const cachedStatus = useAppSelector((state) => (gameId ? lobbyApi.endpoints.getLobby.select(gameId)(state).data?.status : undefined));
  const query = useGetLobbyQuery(gameId ?? skipToken, {
    pollingInterval: cachedStatus && cachedStatus !== 'LOBBY' ? 0 : LOBBY_POLL_MS,
    skipPollingIfUnfocused: true,
  });

  return {
    lobby: query.data ?? null,
    isLoading: query.isLoading,
    error: apiErrorOf(query.error),
    refetch: () => void query.refetch(),
  };
}

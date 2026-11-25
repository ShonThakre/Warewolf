import { gameLogSchema, type GameLog } from '@warewolf/contracts';
import { api } from './api';

/**
 * LOG-01: the game log, built and redacted by the server. `getGameLog` is the
 * caller's own view (public facts, their own record, everything once the game
 * is over). `getHostLog` is the host's live view with every secret.
 * `useLiveSeat` invalidates the tag when a stored event arrives.
 */
export const logApi = api.injectEndpoints({
  endpoints: (build) => ({
    getGameLog: build.query<GameLog, string>({
      query: (gameId) => `games/${gameId}/log`,
      extraOptions: { schema: gameLogSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'GameLog', id: gameId }],
    }),
    getHostLog: build.query<GameLog, string>({
      query: (gameId) => `games/${gameId}/host/log`,
      extraOptions: { schema: gameLogSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'GameLog', id: `host:${gameId}` }],
    }),
  }),
});

export const { useGetGameLogQuery, useGetHostLogQuery } = logApi;

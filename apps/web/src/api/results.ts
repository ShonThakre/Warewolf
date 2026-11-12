import { gameResultsSchema, type GameResults } from '@warewolf/contracts';
import { api } from './api';

/**
 * The end-of-game recap (WW-903a). Screens use `useResults` in
 * `src/game/state/results.ts`. A finished game's recap never changes, so it
 * is cached for the life of the page.
 */
export const resultsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Any seat. 409 PHASE_CONFLICT while the game is in the lobby or running, so only ask once it has ended. */
    getResults: build.query<GameResults, string>({
      query: (gameId) => `games/${gameId}/results`,
      extraOptions: { schema: gameResultsSchema },
      keepUnusedDataFor: 3600,
    }),
  }),
});

export const { useGetResultsQuery } = resultsApi;

import { dayTalliesResponseSchema, type DayTalliesResponse } from '@warewolf/contracts';
import { api } from './api';

/** Public vote tallies (WW-904, OD-85). Screens use `useDayTallies` in `src/game/state/tallies.ts`. */
export const talliesApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Any seat. Closed ballots only, oldest first. */
    getTallies: build.query<DayTalliesResponse, string>({
      query: (gameId) => `games/${gameId}/tallies`,
      extraOptions: { schema: dayTalliesResponseSchema },
    }),
  }),
});

export const { useGetTalliesQuery } = talliesApi;

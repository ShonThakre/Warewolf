import { hostDashboardSchema, type HostDashboard } from '@warewolf/contracts';
import { api } from './api';

/**
 * The host dashboard (WW-1202a). Screens use `useHostDashboard` in
 * `src/game/state/hostDashboard.ts`. The payload holds every secret of the
 * game, so it is dropped from the cache as soon as no host screen shows it.
 */
export const hostDashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Host only: 403 NOT_HOST for anyone else, 409 before the deal. */
    getHostDashboard: build.query<HostDashboard, string>({
      query: (gameId) => `games/${gameId}/host/dashboard`,
      extraOptions: { schema: hostDashboardSchema },
      keepUnusedDataFor: 0,
    }),
  }),
});

export const { useGetHostDashboardQuery } = hostDashboardApi;

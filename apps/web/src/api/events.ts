import { gameEventsResponseSchema, type GameEventsResponse } from '@warewolf/contracts';
import { api } from './api';

/** Reconnect catch-up. The host dashboard reads it; player screens do not. */
export const eventsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getEvents: build.query<GameEventsResponse, { gameId: string; afterSeq: number }>({
      query: ({ gameId, afterSeq }) => `games/${gameId}/events?afterSeq=${afterSeq}`,
      extraOptions: { schema: gameEventsResponseSchema },
      keepUnusedDataFor: 0,
    }),
  }),
});

export const { useGetEventsQuery } = eventsApi;

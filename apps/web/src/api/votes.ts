import { castVoteResponseSchema, type CastVoteRequest, type CastVoteResponse } from '@warewolf/contracts';
import { api } from './api';

/**
 * Ballots (WW-901, WEB-08). Screens cast through `useCastVote`.
 * The response is only the caller's own vote.
 */
export const votesApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Refusals: PHASE_CONFLICT when voting is closed or a vote cannot be
     * replaced, VOTE_INELIGIBLE when the seat or the target cannot be chosen.
     * The message is safe to show as is.
     */
    castVote: build.mutation<CastVoteResponse, { gameId: string } & CastVoteRequest>({
      query: ({ gameId, ...body }) => ({ url: `games/${gameId}/votes`, method: 'POST', body }),
      extraOptions: { schema: castVoteResponseSchema },
    }),
  }),
});

export const { useCastVoteMutation } = votesApi;

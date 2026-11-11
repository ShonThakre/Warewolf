import {
  IDEMPOTENCY_KEY_HEADER,
  myActionsSchema,
  submitActionResponseSchema,
  type MyActions,
  type SubmitActionRequest,
  type SubmitActionResponse,
} from '@warewolf/contracts';
import { api } from './api';

/**
 * Ability actions (Phase 6). Screens use the hooks in
 * `src/game/state/actions.ts`, which pick the Idempotency-Key.
 *
 * The caller's own actions stay in memory only while a screen shows them
 * (`keepUnusedDataFor: 0`), like the private role.
 */
export const actionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Each of the caller's abilities, whether it is open now, and their current choice this round. */
    getMyActions: build.query<MyActions, string>({
      query: (gameId) => `games/${gameId}/me/actions`,
      extraOptions: { schema: myActionsSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'MyActions', id: gameId }],
      keepUnusedDataFor: 0,
    }),

    /**
     * Refusals: NOT_FOUND, ACTION_NOT_YOUR_ABILITY, ACTION_DEAD,
     * ACTION_WRONG_PHASE, ACTION_NO_CHARGES, ACTION_TARGET_ILLEGAL (with
     * `issues[0].message` written for the player), IDEMPOTENCY_CONFLICT.
     * The caller's actions refetch either way.
     */
    submitAction: build.mutation<SubmitActionResponse, { gameId: string; idempotencyKey: string } & SubmitActionRequest>({
      query: ({ gameId, idempotencyKey, ...body }) => ({
        url: `games/${gameId}/actions`,
        method: 'POST',
        body,
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      }),
      extraOptions: { schema: submitActionResponseSchema },
      invalidatesTags: (_result, _error, { gameId }) => [{ type: 'MyActions', id: gameId }],
    }),
  }),
});

export const { useGetMyActionsQuery, useSubmitActionMutation } = actionsApi;

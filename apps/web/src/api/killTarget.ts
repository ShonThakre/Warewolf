import { killTargetViewSchema, type KillTargetView, type SetKillTargetRequest } from '@warewolf/contracts';
import { api } from './api';

/**
 * The host's kill confirmation (WW-803a). Screens use the hooks in
 * `src/game/state/killTarget.ts`. The view names which wolf named which
 * player, so it stays in memory only while a host screen shows it.
 */
export const killTargetApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Host only, and only during host confirm and the reaction window. */
    getKillTarget: build.query<KillTargetView, string>({
      query: (gameId) => `games/${gameId}/host/kill-target`,
      extraOptions: { schema: killTargetViewSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'KillTarget', id: gameId }],
      keepUnusedDataFor: 0,
    }),

    /**
     * Replaces the choice until host confirm closes. Refusals: NOT_HOST,
     * PHASE_CONFLICT, KILL_TARGET_NOT_SUBMITTED (the player no wolf named).
     * The message is safe to show as is.
     */
    setKillTarget: build.mutation<KillTargetView, { gameId: string } & SetKillTargetRequest>({
      query: ({ gameId, ...body }) => ({ url: `games/${gameId}/host/kill-target`, method: 'POST', body }),
      extraOptions: { schema: killTargetViewSchema },
      invalidatesTags: (_result, _error, { gameId }) => [{ type: 'KillTarget', id: gameId }],
    }),
  }),
});

export const { useGetKillTargetQuery, useSetKillTargetMutation } = killTargetApi;

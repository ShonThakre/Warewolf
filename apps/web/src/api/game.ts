import {
  gameStateSchema,
  hostRosterSchema,
  myRoleSchema,
  startGameResponseSchema,
  type ClosePhaseRequest,
  type GameState,
  type HostRoster,
  type MyRole,
  type StartGameRequest,
  type StartGameResponse,
} from '@warewolf/contracts';
import { api } from './api';

/**
 * Start and the role projections (Phase 4). Screens use the hooks in
 * `src/game/state/role.ts` for reads and `useStartGameMutation` to start.
 *
 * Private data stays in memory only, and only while a screen shows it:
 * `keepUnusedDataFor: 0` drops a role from the cache as soon as nothing
 * subscribes, and the hooks unsubscribe when the seat is cleared
 * (docs/werewolf/ui-ux-plan.md, section 10).
 */
export const gameApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Host only. Send `acknowledgeWarnings: true` only after the host has seen
     * the warnings. Refusals: NOT_HOST, GAME_STARTED, CONFIG_INVALID,
     * SEAT_COUNT_MISMATCH, WARNINGS_UNACKNOWLEDGED. The lobby refetches either
     * way, so its `start` blockers explain a refusal.
     */
    startGame: build.mutation<StartGameResponse, { gameId: string } & StartGameRequest>({
      query: ({ gameId, ...body }) => ({ url: `games/${gameId}/start`, method: 'POST', body }),
      extraOptions: { schema: startGameResponseSchema },
      invalidatesTags: (_result, _error, { gameId }) => [
        { type: 'Lobby', id: gameId },
        { type: 'GameState', id: gameId },
      ],
    }),

    /**
     * Phase, round, deadline, and public seats (Phase 5). Any seat. Screens
     * read it through `useGameState` in `src/game/state/phase.ts`, which polls
     * until realtime events replace polling in Phase 11.
     */
    getGameState: build.query<GameState, string>({
      query: (gameId) => `games/${gameId}/state`,
      extraOptions: { schema: gameStateSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'GameState', id: gameId }],
    }),

    /**
     * Host only. Send the `stateVersion` the screen shows. Refusals: NOT_HOST,
     * and PHASE_CONFLICT when the screen is stale, a second click raced the
     * first, or the timer got there first. The state refetches either way, so
     * a refusal leaves the screen showing the current phase.
     */
    closePhase: build.mutation<GameState, { gameId: string } & ClosePhaseRequest>({
      query: ({ gameId, ...body }) => ({ url: `games/${gameId}/host/phase/close`, method: 'POST', body }),
      extraOptions: { schema: gameStateSchema },
      invalidatesTags: (_result, _error, { gameId }) => [
        { type: 'GameState', id: gameId },
        { type: 'Lobby', id: gameId },
        { type: 'HostRoster', id: gameId },
        // A new phase opens or closes abilities, and locks submitted actions.
        { type: 'MyActions', id: gameId },
      ],
    }),

    /** The caller's own role. PHASE_CONFLICT before the deal. */
    getMyRole: build.query<MyRole, string>({
      query: (gameId) => `games/${gameId}/me`,
      extraOptions: { schema: myRoleSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'MyRole', id: gameId }],
      keepUnusedDataFor: 0,
    }),

    /** Host only: every seat's role. NOT_HOST for anyone else, PHASE_CONFLICT before the deal. */
    getHostRoster: build.query<HostRoster, string>({
      query: (gameId) => `games/${gameId}/host/roster`,
      extraOptions: { schema: hostRosterSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'HostRoster', id: gameId }],
      keepUnusedDataFor: 0,
    }),
  }),
});

export const { useStartGameMutation, useGetMyRoleQuery, useGetHostRosterQuery, useGetGameStateQuery, useClosePhaseMutation } = gameApi;

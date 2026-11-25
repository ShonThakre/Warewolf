import {
  configurationResponseSchema,
  leaveGameResponseSchema,
  lobbyProjectionSchema,
  rejoinCodeResponseSchema,
  rolePackListSchema,
  seatCredentialsSchema,
  type ChangeAvatarRequest,
  type ConfigurationResponse,
  type CreateGameRequest,
  type JoinGameRequest,
  type LeaveGameRequest,
  type LeaveGameResponse,
  type LobbyProjection,
  type RejoinCodeResponse,
  type RejoinGameRequest,
  type RolePackSummary,
  type SeatCredentials,
} from '@warewolf/contracts';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { GameConfiguration } from '@warewolf/domain';
import { deviceKey, saveProfile } from '../session/device';
import { cleared, hostChanged, rejoinCodeChanged, seated } from '../session/sessionSlice';
import { api } from './api';

/** Lobby polling interval while the seat is in the lobby. */
export const LOBBY_POLL_MS = 2000;

/** Replaces the cached lobby with the projection a mutation returned, so screens update without a refetch. */
async function applyLobby(
  gameId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the lifecycle dispatch RTK Query passes in
  dispatch: ThunkDispatch<any, unknown, UnknownAction>,
  queryFulfilled: Promise<{ data: LobbyProjection }>,
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    dispatch(lobbyApi.util.upsertQueryData('getLobby', gameId, data));
    dispatch(hostChanged(data.you.isHost));
  } catch {
    // The error is on the mutation result.
  }
}

/** ID-01: every create, join, and rejoin carries this device's key, so the device can get its seat back later. */
const withDevice = <T extends object>(body: T): T & { deviceKey: string } => ({ ...body, deviceKey: deviceKey() });

export const lobbyApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRolePacks: build.query<RolePackSummary[], void>({
      query: () => 'role-packs',
      extraOptions: { schema: rolePackListSchema },
    }),

    createGame: build.mutation<SeatCredentials, CreateGameRequest>({
      query: (body) => ({ url: 'games', method: 'POST', body: withDevice(body) }),
      extraOptions: { schema: seatCredentialsSchema },
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          dispatch(seated((await queryFulfilled).data));
          saveProfile({ displayName: arg.displayName, ...(arg.avatarId ? { avatarId: arg.avatarId } : {}) });
        } catch {
          // Shown by the caller from the mutation's error.
        }
      },
    }),

    /** ID-01: when this device already holds a seat in the room, the response is that seat with `resumed: true`. */
    joinGame: build.mutation<SeatCredentials, JoinGameRequest>({
      query: (body) => ({ url: 'games/join', method: 'POST', body: withDevice(body) }),
      extraOptions: { schema: seatCredentialsSchema },
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(seated(data));
          if (!data.resumed) saveProfile({ displayName: arg.displayName, ...(arg.avatarId ? { avatarId: arg.avatarId } : {}) });
        } catch {
          // Shown by the caller from the mutation's error.
        }
      },
    }),

    /** ID-01: reclaim a seat with its rejoin code. The old device's token stops working. */
    rejoinGame: build.mutation<SeatCredentials, RejoinGameRequest>({
      query: (body) => ({ url: 'games/rejoin', method: 'POST', body: withDevice(body) }),
      extraOptions: { schema: seatCredentialsSchema },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          dispatch(seated((await queryFulfilled).data));
        } catch {
          // Shown by the caller.
        }
      },
    }),

    /** ID-01: a new rejoin code for this seat. The previous code stops working. */
    newRejoinCode: build.mutation<RejoinCodeResponse, { gameId: string }>({
      query: ({ gameId }) => ({ url: `games/${gameId}/me/rejoin-code`, method: 'POST' }),
      extraOptions: { schema: rejoinCodeResponseSchema },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          dispatch(rejoinCodeChanged((await queryFulfilled).data.rejoinCode));
        } catch {
          // Shown by the caller.
        }
      },
    }),

    getLobby: build.query<LobbyProjection, string>({
      query: (gameId) => `games/${gameId}`,
      extraOptions: { schema: lobbyProjectionSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'Lobby', id: gameId }],
    }),

    leaveGame: build.mutation<LeaveGameResponse, { gameId: string } & LeaveGameRequest>({
      query: ({ gameId, ...body }) => ({ url: `games/${gameId}/leave`, method: 'POST', body }),
      extraOptions: { schema: leaveGameResponseSchema },
      async onQueryStarted({ gameId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(cleared());
          dispatch(lobbyApi.util.invalidateTags([{ type: 'Lobby', id: gameId }]));
        } catch {
          // Shown by the caller.
        }
      },
    }),

    kickPlayer: build.mutation<LobbyProjection, { gameId: string; playerId: string }>({
      query: ({ gameId, playerId }) => ({ url: `games/${gameId}/players/${playerId}/kick`, method: 'POST' }),
      extraOptions: { schema: lobbyProjectionSchema },
      onQueryStarted: ({ gameId }, { dispatch, queryFulfilled }) => applyLobby(gameId, dispatch, queryFulfilled),
    }),

    transferHost: build.mutation<LobbyProjection, { gameId: string; playerId: string }>({
      query: ({ gameId, playerId }) => ({ url: `games/${gameId}/host/transfer`, method: 'POST', body: { playerId } }),
      extraOptions: { schema: lobbyProjectionSchema },
      onQueryStarted: ({ gameId }, { dispatch, queryFulfilled }) => applyLobby(gameId, dispatch, queryFulfilled),
      // Also allowed during a game, where the host mark lives in the game state.
      invalidatesTags: (_result, _error, { gameId }) => [{ type: 'GameState', id: gameId }],
    }),

    /** Lobby only. A taken avatar fails with AVATAR_TAKEN; read it with apiErrorOf. */
    changeAvatar: build.mutation<LobbyProjection, { gameId: string } & ChangeAvatarRequest>({
      query: ({ gameId, avatarId }) => ({ url: `games/${gameId}/me/avatar`, method: 'PUT', body: { avatarId } }),
      extraOptions: { schema: lobbyProjectionSchema },
      onQueryStarted: ({ gameId }, { dispatch, queryFulfilled }) => applyLobby(gameId, dispatch, queryFulfilled),
    }),

    cancelGame: build.mutation<LobbyProjection, { gameId: string }>({
      query: ({ gameId }) => ({ url: `games/${gameId}/host/cancel`, method: 'POST' }),
      extraOptions: { schema: lobbyProjectionSchema },
      onQueryStarted: ({ gameId }, { dispatch, queryFulfilled }) => applyLobby(gameId, dispatch, queryFulfilled),
      // Also allowed during a game, which then shows the cancellation.
      invalidatesTags: (_result, _error, { gameId }) => [{ type: 'GameState', id: gameId }],
    }),

    getConfiguration: build.query<ConfigurationResponse, string>({
      query: (gameId) => `games/${gameId}/configuration`,
      extraOptions: { schema: configurationResponseSchema },
      providesTags: (_result, _error, gameId) => [{ type: 'Configuration', id: gameId }],
    }),

    saveConfiguration: build.mutation<ConfigurationResponse, { gameId: string; draft: GameConfiguration }>({
      query: ({ gameId, draft }) => ({ url: `games/${gameId}/configuration`, method: 'PUT', body: draft }),
      extraOptions: { schema: configurationResponseSchema },
      async onQueryStarted({ gameId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(lobbyApi.util.upsertQueryData('getConfiguration', gameId, data));
          dispatch(lobbyApi.util.invalidateTags([{ type: 'Lobby', id: gameId }]));
        } catch {
          // Shown by the caller.
        }
      },
    }),

    /** Checks a draft without saving it, for live feedback while the host edits. */
    checkConfiguration: build.mutation<ConfigurationResponse, { gameId: string; draft: GameConfiguration }>({
      query: ({ gameId, draft }) => ({ url: `games/${gameId}/configuration/validate`, method: 'POST', body: draft }),
      extraOptions: { schema: configurationResponseSchema },
    }),
  }),
});

export const {
  useGetRolePacksQuery,
  useCreateGameMutation,
  useJoinGameMutation,
  useRejoinGameMutation,
  useNewRejoinCodeMutation,
  useGetLobbyQuery,
  useLeaveGameMutation,
  useKickPlayerMutation,
  useTransferHostMutation,
  useChangeAvatarMutation,
  useCancelGameMutation,
  useGetConfigurationQuery,
  useSaveConfigurationMutation,
  useCheckConfigurationMutation,
} = lobbyApi;

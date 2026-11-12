import { CONNECTION_STATUSES, FACTIONS, GAME_MODES, GAME_PHASES, GAME_STATUSES } from '@warewolf/domain';
import { z } from 'zod';

/** Room codes avoid look-alike characters: no I, L, O, 0, or 1. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`), 'Room codes are 6 letters and digits.');

/** OD-66: trimmed, 2 to 24 characters, no control characters. Unique per game, ignoring case. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(24, 'Use at most 24 characters.')
  .regex(/^[^\p{Cc}]+$/u, 'Names cannot contain control characters.');

export const gameModeSchema = z.enum(GAME_MODES);

/** Players pick one of these portraits in the lobby. Numbered 1 to 36; art files are avatar_01.png to avatar_36.png. */
export const AVATAR_COUNT = 36;
export const avatarIdSchema = z.number().int().min(1).max(AVATAR_COUNT);

// POST /games
export const createGameRequestSchema = z.object({
  displayName: displayNameSchema,
  mode: gameModeSchema.default('INFECTION'),
  /** Optional. Without it the server assigns avatar 1. */
  avatarId: avatarIdSchema.optional(),
});
export type CreateGameRequest = z.input<typeof createGameRequestSchema>;

/** The token is returned once. Store it on the client; the server keeps only its hash. */
export const seatCredentialsSchema = z.object({
  gameId: z.uuid(),
  roomCode: roomCodeSchema,
  playerId: z.uuid(),
  token: z.string().min(20),
  isHost: z.boolean(),
});
export type SeatCredentials = z.infer<typeof seatCredentialsSchema>;

// POST /games/join
export const joinGameRequestSchema = z.object({
  roomCode: roomCodeSchema,
  displayName: displayNameSchema,
  /** Optional. Without it the server assigns the lowest avatar nobody in the room has. */
  avatarId: avatarIdSchema.optional(),
});
export type JoinGameRequest = z.input<typeof joinGameRequestSchema>;

// POST /games/:gameId/leave
export const leaveGameRequestSchema = z.object({
  /** Host only: hand the room to this seat instead of cancelling it. */
  hostPlayerId: z.uuid().optional(),
});
export type LeaveGameRequest = z.input<typeof leaveGameRequestSchema>;

export const leaveGameResponseSchema = z.object({ gameCancelled: z.boolean() });
export type LeaveGameResponse = z.infer<typeof leaveGameResponseSchema>;

// PUT /games/:gameId/me/avatar
export const changeAvatarRequestSchema = z.object({ avatarId: avatarIdSchema });
export type ChangeAvatarRequest = z.input<typeof changeAvatarRequestSchema>;

// POST /games/:gameId/host/transfer
export const transferHostRequestSchema = z.strictObject({ playerId: z.uuid() });
export type TransferHostRequest = z.input<typeof transferHostRequestSchema>;

/** Why the host cannot start yet. Warnings are not blockers; they need acknowledgement at start. */
export const START_BLOCKERS = ['NOT_LOBBY', 'SEATS_OPEN', 'SEATS_OVER', 'CONFIG_INVALID'] as const;
export const startBlockerSchema = z.enum(START_BLOCKERS);

export const lobbyPlayerSchema = z.object({
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int().min(1),
  /** 1 to 36. Unique within a game, so the lobby can show which avatars are taken. */
  avatarId: avatarIdSchema,
  isHost: z.boolean(),
  connectionStatus: z.enum(CONNECTION_STATUSES),
});
export type LobbyPlayer = z.infer<typeof lobbyPlayerSchema>;

export const teamSummarySchema = z.object({
  playerCount: z.number().int(),
  selectedSeats: z.number().int(),
  remainingSeats: z.number().int(),
  factions: z.record(z.enum(FACTIONS), z.number().int()),
  startingPack: z.number().int(),
  wolfCap: z.number().int(),
  infectionSuccesses: z.number().int().nullable(),
});

/**
 * GET /games/:gameId before start. Every member sees the seats and the
 * configuration summary. There are no secrets in the lobby: roles are not dealt yet.
 */
export const lobbyProjectionSchema = z.object({
  gameId: z.uuid(),
  roomCode: roomCodeSchema,
  status: z.enum(GAME_STATUSES),
  phase: z.enum(GAME_PHASES),
  mode: gameModeSchema,
  rolePackId: z.string(),
  /** Seats the configuration needs. Join is closed when every seat is taken. */
  playerCount: z.number().int(),
  hostPlayerId: z.uuid(),
  /** Increments on every lobby change. Clients can skip re-rendering when it has not moved. */
  stateVersion: z.number().int(),
  players: z.array(lobbyPlayerSchema),
  you: z.object({ playerId: z.uuid(), isHost: z.boolean() }),
  configuration: z.object({
    valid: z.boolean(),
    errorCount: z.number().int(),
    warningCount: z.number().int(),
    summary: teamSummarySchema,
  }),
  start: z.object({
    ready: z.boolean(),
    blockers: z.array(startBlockerSchema),
    requiresWarningAcknowledgement: z.boolean(),
  }),
});
export type LobbyProjection = z.infer<typeof lobbyProjectionSchema>;

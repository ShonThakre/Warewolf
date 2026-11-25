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

/**
 * ID-01: a random secret the client keeps per device (localStorage, or
 * Preferences in the APK). It is the guest's identity across visits: joining a
 * room where this device already holds a seat gives that seat back instead of
 * a new one. Sent only in request bodies. The server keeps its SHA-256.
 */
export const deviceKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, 'Device keys are 32 to 128 URL-safe characters.');

/** ID-01: rejoin codes use the room code alphabet. 8 characters, shown as XXXX-XXXX. */
export const REJOIN_CODE_LENGTH = 8;

/** Accepts `k7p4-qx2m`, `K7P4 QX2M`, or `K7P4QX2M`; parses to `K7P4QX2M`. */
export const rejoinCodeSchema = z
  .string()
  .transform((raw) => raw.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${REJOIN_CODE_LENGTH}}$`), 'Rejoin codes are 8 letters and digits.'));

/** `K7P4QX2M` → `K7P4-QX2M`. Display only; the dash is never required. */
export function formatRejoinCode(code: string): string {
  const half = REJOIN_CODE_LENGTH / 2;
  return code.length === REJOIN_CODE_LENGTH ? `${code.slice(0, half)}-${code.slice(half)}` : code;
}

// POST /games
export const createGameRequestSchema = z.object({
  displayName: displayNameSchema,
  mode: gameModeSchema.default('INFECTION'),
  /** Optional. Without it the server assigns avatar 1. */
  avatarId: avatarIdSchema.optional(),
  deviceKey: deviceKeySchema.optional(),
});
export type CreateGameRequest = z.input<typeof createGameRequestSchema>;

/** The token is returned once. Store it on the client; the server keeps only its hash. */
export const seatCredentialsSchema = z.object({
  gameId: z.uuid(),
  roomCode: roomCodeSchema,
  playerId: z.uuid(),
  token: z.string().min(20),
  isHost: z.boolean(),
  /**
   * ID-01: the code that reclaims this seat from another device. Returned at
   * create, join, and rejoin. Optional so seats stored before ID-01 still parse.
   */
  rejoinCode: z.string().optional(),
  /** ID-01: true when this response gave back a seat the player already had. */
  resumed: z.boolean().optional(),
});
export type SeatCredentials = z.infer<typeof seatCredentialsSchema>;

// POST /games/join
export const joinGameRequestSchema = z.object({
  roomCode: roomCodeSchema,
  displayName: displayNameSchema,
  /** Optional. Without it the server assigns the lowest avatar nobody in the room has. */
  avatarId: avatarIdSchema.optional(),
  /** ID-01: when this device already holds a seat in the room, that seat is returned (`resumed: true`). */
  deviceKey: deviceKeySchema.optional(),
});
export type JoinGameRequest = z.input<typeof joinGameRequestSchema>;

// POST /games/rejoin (ID-01)
export const rejoinGameRequestSchema = z.object({
  roomCode: roomCodeSchema,
  rejoinCode: rejoinCodeSchema,
  /** Binds the reclaimed seat to this device, so later visits resume without the code. */
  deviceKey: deviceKeySchema.optional(),
});
export type RejoinGameRequest = z.input<typeof rejoinGameRequestSchema>;

// POST /games/:gameId/me/rejoin-code (ID-01). Issues a new code; the old one stops working.
export const rejoinCodeResponseSchema = z.object({ rejoinCode: z.string() });
export type RejoinCodeResponse = z.infer<typeof rejoinCodeResponseSchema>;

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

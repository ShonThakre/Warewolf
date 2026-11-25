import { FACTIONS, GAME_STATUSES } from '@warewolf/domain';
import { z } from 'zod';
import { avatarIdSchema } from './lobby.js';

/**
 * LOG-01: the game log, built and redacted on the server.
 * GET /games/:gameId/log (any seat) and GET /games/:gameId/host/log (host).
 *
 * Visibility of an entry:
 * - `PUBLIC`: every seat sees it (deaths, tallies, joins, kicks, presence).
 * - `PRIVATE`: only the caller sees it (their own actions, votes, and results).
 * - `REVEALED`: a secret unlocked because the game is over (every role, every
 *   night action, every ballot, who killed whom). Never sent before FINISHED,
 *   except on the host log, whose dashboard already shows every secret.
 *
 * The schema is strict: a field it does not name cannot leave the server.
 */

export const LOG_VISIBILITIES = ['PUBLIC', 'PRIVATE', 'REVEALED'] as const;
export type LogVisibility = (typeof LOG_VISIBILITIES)[number];

/** Where an entry sits in a round. `LOBBY` entries have round 0. */
export const LOG_STAGES = ['LOBBY', 'NIGHT', 'DAY', 'END'] as const;
export type LogStage = (typeof LOG_STAGES)[number];

export const LOG_KINDS = [
  // Lobby and table
  'ROOM_CREATED',
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'PLAYER_KICKED',
  'HOST_CHANGED',
  'GAME_STARTED',
  'GAME_CANCELLED',
  'GAME_FINISHED',
  // Presence
  'PLAYER_DISCONNECTED',
  'PLAYER_RECONNECTED',
  'SEAT_RECLAIMED',
  // Public round facts
  'PHASE_CHANGED',
  'NIGHT_DEATH',
  'PEACEFUL_NIGHT',
  'DAY_ELIMINATION',
  'VOTE_TALLY',
  'RESULT_PUBLISHED',
  'GHOST_HINT',
  'PLAYER_RETURNED',
  // The caller's own record
  'MY_ACTION',
  'MY_VOTE',
  'PRIVATE_NOTICE',
  // Unlocked at game end
  'ROLE_DEALT',
  'NIGHT_ACTION',
  'KILL',
  'SAVE',
  'BALLOT',
  'INFECTION',
  'CONVERSION',
  'INVESTIGATION',
] as const;
export type LogKind = (typeof LOG_KINDS)[number];

/** A seat as the log names it: a snapshot, so a seat removed in the lobby still renders. */
export const logPlayerSchema = z.strictObject({
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int().min(1),
  avatarId: avatarIdSchema,
});
export type LogPlayer = z.infer<typeof logPlayerSchema>;

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** Every detail a kind may carry. Optional fields; each kind uses a few. */
export const logDetailSchema = z.strictObject({
  /** PHASE_CHANGED */
  phase: z.string().optional(),
  /** GAME_STARTED */
  mode: z.string().optional(),
  playerCount: z.number().int().optional(),
  /** GAME_CANCELLED */
  reason: z.string().optional(),
  /** SEAT_RECLAIMED: `DEVICE` (same device) or `CODE` (rejoin code). */
  via: z.string().optional(),
  /** Deaths and reveals: shown only when public (reveal on death) or REVEALED. */
  roleId: z.string().nullable().optional(),
  faction: z.enum(FACTIONS).nullable().optional(),
  /** DAY_ELIMINATION */
  byVote: z.boolean().optional(),
  /** VOTE_TALLY */
  ballot: z.number().int().optional(),
  counts: z.array(z.strictObject({ player: logPlayerSchema, total: z.number() })).optional(),
  abstentions: z.number().optional(),
  tied: z.boolean().optional(),
  /** Actions: the ability used and what became of it. */
  abilityId: z.string().optional(),
  status: z.string().optional(),
  outcome: z.string().optional(),
  /** KILL: attack types in step order (WOLF_KILL, SNIPER, POISON, ...). */
  causes: z.array(z.string()).optional(),
  /** INVESTIGATION, RESULT_PUBLISHED, PRIVATE_NOTICE: the result as stored for that audience. */
  result: z.record(z.string(), scalar).optional(),
  /** GHOST_HINT */
  text: z.string().optional(),
  /** PRIVATE_NOTICE: the stored event type, for the client's sentence. */
  eventType: z.string().optional(),
  /** PRIVATE_NOTICE: the player's own copy of the event, already redacted when it was written. */
  payload: z.record(z.string(), z.unknown()).optional(),
  /** GAME_FINISHED */
  outcomes: z
    .array(
      z.strictObject({
        scope: z.string(),
        outcome: z.string(),
        faction: z.enum(FACTIONS).nullable(),
        roleId: z.string().nullable(),
        player: logPlayerSchema.nullable(),
      }),
    )
    .optional(),
});
export type LogDetail = z.infer<typeof logDetailSchema>;

export const logEntrySchema = z.strictObject({
  /** Stable React key: `e<seq>` for a stored event, otherwise a derived id. */
  id: z.string(),
  /** The stored event's sequence number, or null for an entry read from game records. */
  seq: z.number().int().nullable(),
  /** ISO time the fact was recorded. */
  at: z.string(),
  roundNumber: z.number().int().min(0),
  stage: z.enum(LOG_STAGES),
  kind: z.enum(LOG_KINDS),
  visibility: z.enum(LOG_VISIBILITIES),
  /** Who did it: the killers of a KILL, the voter of a BALLOT, the host of a kick. */
  actors: z.array(logPlayerSchema),
  /** Who it happened to. */
  targets: z.array(logPlayerSchema),
  detail: logDetailSchema,
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const logRoundSchema = z.strictObject({
  roundNumber: z.number().int().min(1),
  night: z.array(logEntrySchema),
  day: z.array(logEntrySchema),
  /** Public counts for the round header. */
  summary: z.strictObject({ deaths: z.number().int(), saves: z.number().int() }),
});
export type LogRound = z.infer<typeof logRoundSchema>;

export const gameLogSchema = z.strictObject({
  status: z.enum(GAME_STATUSES),
  /** True when REVEALED entries are included: the game is FINISHED, or this is the host log. */
  revealed: z.boolean(),
  /** The highest stored event seq this log includes. The client tracks unread entries with it. */
  lastSeq: z.number().int().min(0),
  /** Before the deal: room created, joins, leaves, kicks, host changes. */
  lobby: z.array(logEntrySchema),
  /** Oldest first. The client chooses the display order. */
  rounds: z.array(logRoundSchema),
  /** After the last round: the finish or the cancel. */
  end: z.array(logEntrySchema),
});
export type GameLog = z.infer<typeof gameLogSchema>;

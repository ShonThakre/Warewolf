import { GAME_PHASES, GAME_STATUSES, LIFE_STATUSES } from '@warewolf/domain';
import { z } from 'zod';
import { avatarIdSchema } from './lobby.js';

/**
 * The phase machine (Phase 5). See docs/werewolf/api-design.md, sections 5
 * and 8.
 *
 * Privacy rule: the state is public facts plus the caller's own seat. It
 * never carries a role, a submission, or anything a phase hides. Which night
 * windows open is fixed by the configuration (OD-74), so `close` reveals
 * nothing the configuration did not already say.
 */

export const PACINGS = ['HOST', 'TIMED'] as const;

/** What closing the current phase does. Null when the phase cannot be closed. */
export const phaseCloseSchema = z.object({
  /**
   * The phase a close moves to, when it does not resolve anything. Null when
   * a resolution decides: the night can end the game, and a ballot can tie.
   */
  next: z.enum(GAME_PHASES).nullable(),
  /** The close runs the night or the day resolution. */
  resolves: z.enum(['NIGHT', 'DAY']).nullable(),
});
export type PhaseClose = z.infer<typeof phaseCloseSchema>;

export const statePlayerSchema = z.object({
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int(),
  avatarId: avatarIdSchema,
  isHost: z.boolean(),
  lifeStatus: z.enum(LIFE_STATUSES),
});
export type StatePlayer = z.infer<typeof statePlayerSchema>;

/** GET /games/:gameId/state. Any seat in the game, in any status. */
export const gameStateSchema = z.object({
  gameId: z.uuid(),
  status: z.enum(GAME_STATUSES),
  phase: z.enum(GAME_PHASES),
  /** 0 in the lobby. A round is one night and the day after it. */
  roundNumber: z.number().int(),
  /** Send it back to POST .../host/phase/close. */
  stateVersion: z.number().int(),
  pacing: z.enum(PACINGS),
  phaseStartedAt: z.iso.datetime(),
  /** When a timed phase closes by itself. Null when the host closes it. */
  phaseEndsAt: z.iso.datetime().nullable(),
  /** The server clock when this was built. A countdown uses `phaseEndsAt - serverNow`, not the device clock. */
  serverNow: z.iso.datetime(),
  close: phaseCloseSchema.nullable(),
  /** Seats in seat order. Life status is public; roles are not. */
  players: z.array(statePlayerSchema),
  you: z.object({
    playerId: z.uuid(),
    isHost: z.boolean(),
    lifeStatus: z.enum(LIFE_STATUSES),
  }),
});
export type GameState = z.infer<typeof gameStateSchema>;

// POST /games/:gameId/host/phase/close

/**
 * The `stateVersion` the host's screen shows. A stale screen, a second click,
 * or a timer that got there first is a 409 PHASE_CONFLICT, so one click never
 * closes two phases.
 */
export const closePhaseRequestSchema = z.strictObject({
  stateVersion: z.number().int().min(0),
});
export type ClosePhaseRequest = z.input<typeof closePhaseRequestSchema>;

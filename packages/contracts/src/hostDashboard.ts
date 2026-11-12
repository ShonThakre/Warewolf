import {
  ACTION_REJECTIONS,
  ACTION_WINDOWS,
  ATTACK_TYPES,
  FACTIONS,
  GAME_PHASES,
  GAME_STATUSES,
  INDIVIDUAL_VICTORY_STATES,
  INFECTION_FAILURES,
  NIGHT_ACTION_STATUSES,
  RESOLUTION_KINDS,
} from '@warewolf/domain';
import { z } from 'zod';
import { hostRosterSchema } from './assignment.js';

/**
 * The host dashboard (WW-1202a). See docs/werewolf/api-design.md, section 8,
 * and the UI plan, section J.
 *
 * Host only: 403 NOT_HOST for any other seat, 409 before the deal. This is
 * the one payload that holds the wolves' submissions, every infection
 * attempt, and every ballot with its voter. Nothing here is ever sent to a
 * player route or a shared room.
 */

export const dashboardOverviewSchema = z.object({
  status: z.enum(GAME_STATUSES),
  phase: z.enum(GAME_PHASES),
  roundNumber: z.number().int(),
  stateVersion: z.number().int(),
  phaseEndsAt: z.iso.datetime().nullable(),
  alive: z.number().int().nonnegative(),
  /** Living seats that count for the pack, including infected seats. */
  wolfAlignedAlive: z.number().int().nonnegative(),
  infection: z.object({
    enabled: z.boolean(),
    successes: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    /** True once the Alpha has died: no further infection (C-09). */
    sealed: z.boolean(),
  }),
});

/** One submitted ability use this round, night or day. Replaced choices are left out. */
export const dashboardSubmissionSchema = z.object({
  actionId: z.uuid(),
  playerId: z.uuid(),
  abilityId: z.string(),
  window: z.enum(ACTION_WINDOWS),
  targetPlayerIds: z.array(z.uuid()),
  status: z.enum(NIGHT_ACTION_STATUSES),
  rejectedReason: z.enum(ACTION_REJECTIONS).nullable(),
  submittedAt: z.iso.datetime(),
});

/** Every attempt, including a failed one and why. A player never sees a failure. */
export const dashboardInfectionSchema = z.object({
  roundNumber: z.number().int().positive(),
  sourcePlayerId: z.uuid(),
  targetPlayerId: z.uuid(),
  outcome: z.enum(['SUCCESS', 'FAILED']),
  failureReason: z.enum(INFECTION_FAILURES).nullable(),
});

export const dashboardBallotSchema = z.object({
  roundNumber: z.number().int().positive(),
  /** 1 is the first ballot, 2 the revote. */
  ballot: z.union([z.literal(1), z.literal(2)]),
  /** True while this ballot is the current phase and votes can still change. */
  open: z.boolean(),
  /** Each seat's standing vote. Replaced votes are left out. Null target is an abstention. */
  votes: z.array(z.object({ voterPlayerId: z.uuid(), targetPlayerId: z.uuid().nullable(), weight: z.number().int().nonnegative() })),
  /** Weighted totals per target, highest first. An open ballot uses each voter's weight as of now (Elder, Mayor). */
  counts: z.array(z.object({ targetPlayerId: z.uuid().nullable(), total: z.number().int().nonnegative() })),
});

export const dashboardEliminationSchema = z.object({
  roundNumber: z.number().int().positive(),
  phaseKind: z.enum(RESOLUTION_KINDS),
  playerId: z.uuid(),
  roleAtDeath: z.string(),
  factionAtDeath: z.enum(FACTIONS),
  /** Every contributor, in step order (OD-13). Host and audit only. */
  causes: z.array(z.object({ type: z.enum(ATTACK_TYPES), via: z.enum(['PACK', 'ABILITY', 'EFFECT', 'REDIRECT']), actorIds: z.array(z.uuid()) })),
  revealedPublicly: z.boolean(),
});

export const dashboardVictorySchema = z.object({
  /** Set once the game has finished. */
  outcome: z.object({ team: z.enum(FACTIONS).nullable(), draw: z.boolean() }).nullable(),
  /** Seats whose individual victory has been decided: achieved, failed, or revoked. `NONE` (undecided, or no individual win) is left out. */
  individuals: z.array(z.object({ playerId: z.uuid(), roleId: z.string(), state: z.enum(INDIVIDUAL_VICTORY_STATES) })),
});

/** GET /games/:gameId/host/dashboard */
export const hostDashboardSchema = z.object({
  overview: dashboardOverviewSchema,
  roster: hostRosterSchema,
  /** The current round only. The wolves' kill choices are here. */
  submissions: z.array(dashboardSubmissionSchema),
  infections: z.array(dashboardInfectionSchema),
  /** Every ballot of the game, oldest first. */
  ballots: z.array(dashboardBallotSchema),
  eliminations: z.array(dashboardEliminationSchema),
  victory: dashboardVictorySchema,
});
export type HostDashboard = z.infer<typeof hostDashboardSchema>;
export type DashboardBallot = z.infer<typeof dashboardBallotSchema>;

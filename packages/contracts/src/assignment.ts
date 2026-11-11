import {
  ABILITY_STATUSES,
  ABILITY_TIMINGS,
  CAPABILITIES,
  FACTIONS,
  GAME_PHASES,
  GAME_STATUSES,
  LIFE_STATUSES,
  PROPHET_QUESTIONS,
} from '@warewolf/domain';
import { z } from 'zod';
import { avatarIdSchema } from './lobby.js';

/**
 * Start and the role projections (Phase 4). See docs/werewolf/api-design.md,
 * sections 1 and 4.
 *
 * Privacy rule: a player's projection names only their own role. Teammates,
 * when the configuration shows them, are seats and names without role ids.
 * Only the host roster lists every role.
 */

// POST /games/:gameId/start

/**
 * Strict on purpose: an unknown key such as `seed` is a 422, so no client can
 * believe it influenced the deal. The server shuffles with a CSPRNG.
 */
export const startGameRequestSchema = z.strictObject({
  /** Required as `true` when the lobby projection says `start.requiresWarningAcknowledgement`. */
  acknowledgeWarnings: z.boolean().default(false),
});
export type StartGameRequest = z.input<typeof startGameRequestSchema>;

/** Public facts only. Each seat reads its own role from GET /games/:gameId/me. */
export const startGameResponseSchema = z.object({
  gameId: z.uuid(),
  status: z.enum(GAME_STATUSES),
  phase: z.enum(GAME_PHASES),
  roundNumber: z.number().int(),
  stateVersion: z.number().int(),
});
export type StartGameResponse = z.infer<typeof startGameResponseSchema>;

/** Mirrors the domain `TargetRule`. The client builds target prompts from it. */
export const targetRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({
    kind: z.literal('PLAYERS'),
    count: z.number().int(),
    life: z.enum(['ALIVE', 'DEAD']),
    self: z.boolean(),
    notSameAsLastRound: z.boolean(),
  }),
  z.object({ kind: z.literal('FINAL_WOLF_TARGET') }),
  z.object({ kind: z.literal('OWN_RESULT') }),
  z.object({ kind: z.literal('QUESTION'), questions: z.array(z.enum(PROPHET_QUESTIONS)).readonly() }),
  z.object({ kind: z.literal('TEXT'), maxLength: z.number().int().positive() }),
]);
export type TargetRuleDto = z.infer<typeof targetRuleSchema>;

/** A role as its holder sees it. Descriptions come from the public catalog by `id` and `profileId`. */
export const roleRefSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  name: z.string(),
  faction: z.enum(FACTIONS),
});
export type RoleRef = z.infer<typeof roleRefSchema>;

/**
 * One of the caller's own abilities, with this game's limits. The client
 * writes the sentences ("once per game", "from night 2") from these fields.
 * Whether it can be used right now arrives with the phase machine (Phase 6).
 */
export const ownAbilitySchema = z.object({
  abilityInstanceId: z.uuid(),
  abilityId: z.string(),
  /** Null when a handler carries the mechanic, such as the Assassin's mark. */
  capability: z.enum(CAPABILITIES).nullable(),
  timing: z.enum(ABILITY_TIMINGS),
  status: z.enum(ABILITY_STATUSES),
  /** Uses left this game. Null is unlimited. */
  usesRemaining: z.number().int().nullable(),
  /** Uses per night, or per day for day abilities. Null is unlimited. */
  usesPerPhase: z.number().int().nullable(),
  /** Nights the ability rests after a use. */
  cooldownNights: z.number().int(),
  availableFromRound: z.number().int(),
  /** Usable only in this round, such as a night-1 mark. */
  onlyRound: z.number().int().nullable(),
  /** Last round a copied ability lasts. Null for dealt abilities. */
  expiresRound: z.number().int().nullable(),
  target: targetRuleSchema,
  /** Set when choosing this ability cancels the player's other pending choice in the same group. */
  exclusiveGroup: z.string().optional(),
});
export type OwnAbility = z.infer<typeof ownAbilitySchema>;

/** A teammate the caller is allowed to know. Never carries a role. */
export const teammateSchema = z.object({
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int(),
});
export type Teammate = z.infer<typeof teammateSchema>;

/** GET /games/:gameId/me. The caller's own seat and role. 409 before start. */
export const myRoleSchema = z.object({
  gameId: z.uuid(),
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int(),
  lifeStatus: z.enum(LIFE_STATUSES),
  /** Never changes. Shown to the player and the host; others see it only in the end-of-game recap. */
  originalRole: roleRefSchema,
  /** Changes on conversion, such as infection. */
  currentRole: roleRefSchema,
  abilities: z.array(ownAbilitySchema),
  /**
   * True when this configuration shows this player their pack (Classic Pack
   * Wolves). False everywhere in Infection Edition. When true and `teammates`
   * is empty, the player is the only one.
   */
  teammatesVisible: z.boolean(),
  teammates: z.array(teammateSchema),
});
export type MyRole = z.infer<typeof myRoleSchema>;

export const rosterAbilitySchema = z.object({
  abilityInstanceId: z.uuid(),
  abilityId: z.string(),
  capability: z.enum(CAPABILITIES).nullable(),
  status: z.enum(ABILITY_STATUSES),
  usesRemaining: z.number().int().nullable(),
});
export type RosterAbility = z.infer<typeof rosterAbilitySchema>;

export const rosterEntrySchema = z.object({
  playerId: z.uuid(),
  displayName: z.string(),
  seatNumber: z.number().int(),
  avatarId: avatarIdSchema,
  isHost: z.boolean(),
  lifeStatus: z.enum(LIFE_STATUSES),
  originalRoleId: z.string(),
  originalProfileId: z.string(),
  originalFaction: z.enum(FACTIONS),
  currentRoleId: z.string(),
  currentProfileId: z.string(),
  currentFaction: z.enum(FACTIONS),
  wolfAligned: z.boolean(),
  abilities: z.array(rosterAbilitySchema),
});
export type RosterEntry = z.infer<typeof rosterEntrySchema>;

/** GET /games/:gameId/host/roster. Host only: 403 for anyone else, 409 before start. */
export const hostRosterSchema = z.object({
  gameId: z.uuid(),
  phase: z.enum(GAME_PHASES),
  roundNumber: z.number().int(),
  players: z.array(rosterEntrySchema),
});
export type HostRoster = z.infer<typeof hostRosterSchema>;

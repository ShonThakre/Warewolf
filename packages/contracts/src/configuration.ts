import {
  FACTIONS,
  GAME_MODES,
  KILL_AGGREGATIONS,
  NIGHT_PROFILES,
  VALIDATION_ERROR_CODES,
  VALIDATION_INFO_CODES,
  VALIDATION_WARNING_CODES,
  type GameConfiguration,
} from '@warewolf/domain';
import { z } from 'zod';
import { teamSummarySchema } from './lobby.js';

/**
 * Structure of a configuration draft. This checks shape only. Whether the
 * game is playable is the domain validator's job, and an unplayable draft
 * can still be saved so the host can edit in steps.
 */
const count = z.number().int().min(0);
const limit = count.nullable();
const configValue = z.union([z.string(), z.number(), z.boolean()]);

const abilityOverrideSchema = z.strictObject({
  usesPerGame: z.number().int().nullable().optional(),
  usesPerPhase: z.number().int().nullable().optional(),
  cooldownNights: z.number().int().optional(),
  config: z.record(z.string(), configValue).optional(),
});

const roleEntrySchema = z.strictObject({
  roleId: z.string().min(1).max(64),
  // The domain validator reports bad counts with a precise message, so only the type is checked here.
  count: z.number(),
  faction: z.enum(FACTIONS).optional(),
  abilityProfile: z.string().min(1).max(64).optional(),
  overrides: z.record(z.string(), abilityOverrideSchema).optional(),
});

const revealSchema = z.enum(['CURRENT_ROLE', 'HIDDEN']);

export const gameConfigurationSchema = z.strictObject({
  version: z.literal(1),
  mode: z.enum(GAME_MODES),
  rolePackId: z.string().min(1).max(64),
  playerCount: z.number().int(),
  pacing: z.enum(['HOST', 'TIMED']),
  timers: z
    .strictObject({ nightSeconds: count, daySeconds: count, voteSeconds: count })
    .nullable(),
  roundCap: z.number().int().min(1).max(100),
  rulesetAcknowledgments: z.record(z.string(), z.string()),
  teams: z.strictObject({
    wolfCap: z.number().int(),
    allowMultipleWinners: z.boolean(),
    targets: z.partialRecord(z.enum(FACTIONS), count).optional(),
  }),
  wolves: z.strictObject({
    knowsTeammates: z.boolean(),
    friendlyFire: z.boolean(),
    killAggregation: z.enum(KILL_AGGREGATIONS),
  }),
  infection: z.strictObject({
    enabled: z.boolean(),
    maxSuccesses: z.number().int(),
    attemptsPerNight: z.number().int(),
    eligibility: z.enum(['VILLAGE_ONLY', 'ANY_NON_PACK_WOLF']),
    requiresSurvival: z.boolean(),
    announcement: z.enum(['SILENT', 'PUBLIC']),
    blockedByGuard: z.boolean(),
    blockedByDoctor: z.boolean(),
    alphaDeath: z.literal('SEAL'),
    grantKillNextNight: z.boolean(),
  }),
  roles: z.array(roleEntrySchema).max(64),
  voting: z.strictObject({
    enabled: z.boolean(),
    abstain: z.boolean(),
    changeUntilClose: z.boolean(),
    deadMayVote: z.boolean(),
    tie: z.literal('REVOTE_THEN_NONE'),
    revealOnDayElimination: revealSchema,
    revealOnNightDeath: revealSchema,
  }),
  night: z.strictObject({
    profile: z.enum(NIGHT_PROFILES),
    toggles: z.strictObject({
      protectionBlocksPoison: z.boolean(),
      bodyguardRedirectsPoison: z.boolean(),
      copyInformedDoctor: z.boolean(),
      informBlockedPlayer: z.boolean(),
      trackerIncludesActionType: z.boolean(),
    }),
  }),
  allowHostAdjudication: z.boolean(),
});

/**
 * Parses a draft into the domain type. Zod types optional keys as
 * `T | undefined`; the parse never produces an explicit undefined for a key
 * that was absent, so the cast to the domain's exact-optional type is sound.
 */
export function parseGameConfiguration(input: unknown): GameConfiguration {
  return gameConfigurationSchema.parse(input) as GameConfiguration;
}

export const validationIssueSchema = z.object({
  code: z.enum([...VALIDATION_ERROR_CODES, ...VALIDATION_WARNING_CODES, ...VALIDATION_INFO_CODES]),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  roleId: z.string().optional(),
  abilityId: z.string().optional(),
  decisionIds: z.array(z.string()).optional(),
});
export type ValidationIssueDto = z.infer<typeof validationIssueSchema>;

export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(validationIssueSchema),
  warnings: z.array(validationIssueSchema),
  infos: z.array(validationIssueSchema),
  summary: teamSummarySchema,
});
export type ValidationResultDto = z.infer<typeof validationResultSchema>;

/** GET and PUT /games/:gameId/configuration, and POST .../configuration/validate. */
export const configurationResponseSchema = z.object({
  draft: gameConfigurationSchema,
  validation: validationResultSchema,
  /** True for the host while the game is in the lobby. */
  editable: z.boolean(),
});
export type ConfigurationResponse = z.infer<typeof configurationResponseSchema>;

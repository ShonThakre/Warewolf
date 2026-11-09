/**
 * Role and ability enumerations. Values match docs/werewolf/role-catalog.md.
 * Role definitions themselves arrive in Phase 2 (WW-201).
 */

/** UNRESOLVED roles have no invented powers and cannot be seated. */
export const IMPLEMENTATION_STATUSES = ['CONFIRMED', 'RECOMMENDED', 'UNRESOLVED'] as const;
export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];

export const CAPABILITIES = [
  'INVESTIGATE',
  'PROTECT',
  'HEAL',
  'KILL',
  'POISON',
  'INFECT',
  'BLOCK_ACTION',
  'TRACK',
  'DETECT',
  'ROLE_COPY',
  'ROLE_REVEAL',
  'VOTE_MODIFIER',
  'SURVIVE_DEATH',
  'REVENGE',
  'COMMUNICATE_WITH_DEAD',
  'MODIFY_VOTING',
  'TEAM_SUPPORT',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const INFECTION_BEHAVIORS = [
  'LOSE_ROLE_AND_CONVERT_TO_INFECTED_WOLF',
  'INELIGIBLE',
  'NOT_A_SOURCE',
  'SEAL_INFECTION_ON_DEATH',
] as const;
export type InfectionBehavior = (typeof INFECTION_BEHAVIORS)[number];

export const ABILITY_STATUSES = ['ACTIVE', 'REVOKED', 'EXHAUSTED', 'SCHEDULED'] as const;
export type AbilityStatus = (typeof ABILITY_STATUSES)[number];

export const ABILITY_SOURCES = ['NATIVE', 'COPY', 'INHERITED'] as const;
export type AbilitySource = (typeof ABILITY_SOURCES)[number];

export const INDIVIDUAL_VICTORY_STATES = ['NONE', 'ACHIEVED', 'FAILED', 'REVOKED'] as const;
export type IndividualVictoryState = (typeof INDIVIDUAL_VICTORY_STATES)[number];

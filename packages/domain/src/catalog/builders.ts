import type { Faction } from '../factions.js';
import type { Capability, ImplementationStatus, InfectionBehavior } from '../roles.js';
import type {
  AbilityDefinition,
  AbilityProfile,
  RoleCategory,
  RoleDefinition,
  TargetRule,
  VictoryDefinition,
} from './types.js';

type AbilityInput = Partial<Omit<AbilityDefinition, 'id' | 'capability'>> &
  Pick<AbilityDefinition, 'id'> & { capability: Capability | null };

/** Fills the common defaults: one use per phase, unlimited per game, no cooldown, lost on infection. */
export function ability(input: AbilityInput): AbilityDefinition {
  return {
    handlerKey: null,
    timing: 'NIGHT',
    attackType: null,
    cancels: [],
    usesPerPhase: 1,
    usesPerGame: null,
    cooldownNights: 0,
    availableFromRound: 1,
    onlyRound: null,
    target: { kind: 'NONE' },
    result: null,
    resultAudience: [],
    lostOnInfection: true,
    decisionIds: [],
    config: {},
    ...input,
  };
}

/** One living player other than the actor, unless overridden. */
export function players(input: Partial<Omit<Extract<TargetRule, { kind: 'PLAYERS' }>, 'kind'>> = {}): TargetRule {
  return { kind: 'PLAYERS', count: 1, life: 'ALIVE', self: false, notSameAsLastRound: false, ...input };
}

export const TEAM: VictoryDefinition = { type: 'TEAM' };
export const NO_VICTORY: VictoryDefinition = { type: 'NONE' };

export function individual(trigger: Extract<VictoryDefinition, { type: 'INDIVIDUAL' }>['trigger']): VictoryDefinition {
  return { type: 'INDIVIDUAL', trigger, endGameOnWin: false, revealOnWin: true };
}

export function profile(
  input: Pick<AbilityProfile, 'id' | 'status' | 'description'> & Partial<Omit<AbilityProfile, 'id' | 'status' | 'description'>>,
): AbilityProfile {
  return { abilities: [], victory: TEAM, decisionIds: [], chargePolicy: null, ...input };
}

interface RoleInput {
  id: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  defaultFaction: Faction;
  implementationStatus: ImplementationStatus;
  allowedFactions?: readonly Faction[];
  wolfAligned?: boolean;
  seatable?: boolean;
  uniqueInGame?: boolean;
  requiresFactionChoice?: boolean;
  requiresRoleId?: string;
  infectionTarget?: InfectionBehavior;
  infectionSource?: InfectionBehavior;
  decisionIds?: readonly string[];
  /** Single-profile roles: the profile id is the role id. */
  abilities?: readonly AbilityDefinition[];
  victory?: VictoryDefinition;
  /** Multi-profile roles. The first profile is the default unless `defaultProfileId` is set. */
  profiles?: readonly AbilityProfile[];
  defaultProfileId?: string;
}

export function role(input: RoleInput): RoleDefinition {
  const profiles =
    input.profiles ??
    [
      profile({
        id: input.id,
        status: input.implementationStatus,
        description: input.description,
        abilities: input.abilities ?? [],
        victory: input.victory ?? TEAM,
        decisionIds: input.decisionIds ?? [],
      }),
    ];
  const first = profiles[0];
  if (!first) throw new Error(`Role ${input.id} has no profile`);

  return {
    id: input.id,
    displayName: input.displayName,
    description: input.description,
    category: input.category,
    defaultFaction: input.defaultFaction,
    allowedFactions: input.allowedFactions ?? [input.defaultFaction],
    wolfAligned: input.wolfAligned ?? null,
    implementationStatus: input.implementationStatus,
    seatable: input.seatable ?? true,
    uniqueInGame: input.uniqueInGame ?? false,
    requiresFactionChoice: input.requiresFactionChoice ?? false,
    requiresRoleId: input.requiresRoleId ?? null,
    infection: {
      whenTarget: input.infectionTarget ?? 'LOSE_ROLE_AND_CONVERT_TO_INFECTED_WOLF',
      whenSource: input.infectionSource ?? 'NOT_A_SOURCE',
    },
    defaultProfileId: input.defaultProfileId ?? first.id,
    profiles: Object.fromEntries(profiles.map((p) => [p.id, p])),
    decisionIds: input.decisionIds ?? [],
  };
}

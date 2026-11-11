import type { Faction } from '../factions.js';
import type { Capability, ImplementationStatus, InfectionBehavior } from '../roles.js';
import type { AbilityId, RoleId } from '../snapshot.js';

/**
 * Role definitions are data. Capability handlers (Phase 6 onward) interpret
 * them. Nothing in the engine switches on a role id.
 * See docs/werewolf/role-catalog.md.
 */

export const ROLE_CATEGORIES = [
  'CORE',
  'INVESTIGATION',
  'PROTECTION',
  'SUPPORT',
  'NEUTRAL',
  'TRANSFORMATION',
  'INDEPENDENT',
  'DEFENSIVE',
  'REACTIVE',
  'OFFENSE',
  'DECEPTION',
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export const ABILITY_TIMINGS = ['NIGHT', 'NIGHT_REACTION', 'DAY', 'PASSIVE'] as const;
export type AbilityTiming = (typeof ABILITY_TIMINGS)[number];

/** Named lethal sources. Protection lists which ones it cancels. */
export const ATTACK_TYPES = ['WOLF_KILL', 'SNIPER', 'POISON', 'REVENGE', 'DAY_VOTE'] as const;
export type AttackType = (typeof ATTACK_TYPES)[number];

/** Facts an information ability can return. */
export const RESULT_KINDS = [
  'ALIGNMENT_WOLF_OR_NOT',
  'ROLE_CATEGORY',
  'ROLE_ID',
  'SAME_OR_DIFFERENT_FACTION',
  'ROLE_AT_DEATH',
  'VISITED_PLAYER_IDS',
  'YES_NO',
  'WOLF_KILL_SUBMISSION_COUNT',
  'ATTACKER_IDS',
  /** Fox (Ultimate 20): the target's current team, read from the start-of-night state. */
  'FACTION',
] as const;
export type ResultKind = (typeof RESULT_KINDS)[number];

export const RESULT_AUDIENCES = ['SELF', 'HOST', 'PUBLIC'] as const;
export type ResultAudience = (typeof RESULT_AUDIENCES)[number];

/** Special rules that are more than a capability flag. See role-catalog.md, "handlerKey". */
export const HANDLER_KEYS = [
  'infection.convert',
  'cursed.onSurvivedWolfAttack',
  'jester.onDayElimination',
  'assassin.onTargetEliminated',
  'avenger.queueRevenge',
  'shapeshifter.scheduleCopy',
  'assistant.inheritDoctor',
  'immortal.consumeCharge',
] as const;
export type HandlerKey = (typeof HANDLER_KEYS)[number];

export const PROPHET_QUESTIONS = ['WOLF_PACK_SIZE_AT_LEAST'] as const;
export type ProphetQuestion = (typeof PROPHET_QUESTIONS)[number];

export type TargetRule =
  | { readonly kind: 'NONE' }
  | {
      readonly kind: 'PLAYERS';
      readonly count: number;
      readonly life: 'ALIVE' | 'DEAD';
      readonly self: boolean;
      /** Guard and Shieldbearer: not the same player as the previous round. */
      readonly notSameAsLastRound: boolean;
    }
  /** Doctor informed veto: the target is the host-confirmed final wolf target. */
  | { readonly kind: 'FINAL_WOLF_TARGET' }
  /** Seeker public reveal: publishes the actor's own stored result. */
  | { readonly kind: 'OWN_RESULT' }
  /** Prophet: one whitelisted question. Free text is never accepted. */
  | { readonly kind: 'QUESTION'; readonly questions: readonly ProphetQuestion[] }
  /**
   * Ghost (Ultimate 20): one short text in the payload as \`hint\`. It may not
   * name a player or a seat. No player targets.
   */
  | { readonly kind: 'TEXT'; readonly maxLength: number };

export interface AbilityDefinition {
  readonly id: AbilityId;
  /** Null only when `handlerKey` carries the whole mechanic (for example, the Assassin's mark). */
  readonly capability: Capability | null;
  readonly handlerKey: HandlerKey | null;
  readonly timing: AbilityTiming;
  /** Lethal type this ability adds, for KILL, POISON, and REVENGE. */
  readonly attackType: AttackType | null;
  /** Lethal types this ability negates, for PROTECT and HEAL. */
  readonly cancels: readonly AttackType[];
  /** Uses per night for night abilities, per day for day abilities. Null is unlimited. */
  readonly usesPerPhase: number | null;
  /** Null is unlimited. */
  readonly usesPerGame: number | null;
  /** Nights the ability rests after a use. "Every other night" is 1. */
  readonly cooldownNights: number;
  readonly availableFromRound: number;
  /** Only usable in this round, such as the Assassin's night-1 mark. */
  readonly onlyRound: number | null;
  readonly target: TargetRule;
  readonly result: ResultKind | null;
  readonly resultAudience: readonly ResultAudience[];
  readonly lostOnInfection: boolean;
  /** Open-decision ids whose recommendation this ability encodes. */
  readonly decisionIds: readonly string[];
  /** Capability parameters, such as vote weight or the Doctor's information mode. */
  readonly config: Readonly<Record<string, string | number | boolean>>;
}

export const INDIVIDUAL_TRIGGERS = [
  'ELIMINATED_BY_DAY_VOTE',
  'MARKED_TARGET_ELIMINATED',
  'SOLE_SURVIVOR',
  'ALIVE_AT_GAME_END',
  // Ultimate 20 (docs/werewolf/ultimate-20-rules.md).
  /** Vampire: alive when the game ends, and at least one Servant was ever made. */
  'ALIVE_WITH_SERVANT',
  /** Vampire Servant: wins when a Vampire's own win is recorded. */
  'WITH_VAMPIRE',
  /** Fox: alive at the moment no wolf-aligned player is left. */
  'ALL_WOLVES_ELIMINATED_WHILE_ALIVE',
  /** Necromancer: revived at least one player, and alive when the game ends. */
  'ALIVE_AFTER_REVIVE',
  /** Chaos Demon: three Chaos events changed the game, and alive when five or fewer players remain. */
  'CHAOS_THREE_AND_FINAL_FIVE',
] as const;
export type IndividualTrigger = (typeof INDIVIDUAL_TRIGGERS)[number];

export type VictoryDefinition =
  | { readonly type: 'TEAM' }
  | {
      readonly type: 'INDIVIDUAL';
      readonly trigger: IndividualTrigger;
      /** OD-08: an individual win does not end the game by default. */
      readonly endGameOnWin: boolean;
      readonly revealOnWin: boolean;
    }
  /** No victory condition is defined. Only unresolved roles and profiles use this. */
  | { readonly type: 'NONE' };

/**
 * One way to play a role. Most roles have a single profile. Doctor, Assassin,
 * and Blacksmith keep separate profiles that must never be merged.
 */
export interface AbilityProfile {
  readonly id: string;
  readonly status: ImplementationStatus;
  readonly description: string;
  readonly abilities: readonly AbilityDefinition[];
  readonly victory: VictoryDefinition;
  readonly decisionIds: readonly string[];
  /**
   * UNLIMITED: every ability must keep unlimited uses per game. LIMITED: every
   * ability must keep a finite count. Overrides cannot cross the line, which is
   * how the two Doctor profiles stay unmixed (DOCTOR_PROFILE_MIX).
   */
  readonly chargePolicy: 'UNLIMITED' | 'LIMITED' | null;
}

export interface RoleDefinition {
  readonly id: RoleId;
  readonly displayName: string;
  readonly description: string;
  readonly category: RoleCategory;
  readonly defaultFaction: Faction;
  readonly allowedFactions: readonly Faction[];
  /** Overrides the faction-derived reading for Wolf / Non-Wolf checks. Lone Wolf sets true. */
  readonly wolfAligned: boolean | null;
  readonly implementationStatus: ImplementationStatus;
  /** False for roles that only appear through conversion (Infected Wolf). */
  readonly seatable: boolean;
  readonly uniqueInGame: boolean;
  /** Poisoner and Disruptor: the configuration must name a faction. */
  readonly requiresFactionChoice: boolean;
  /** Healer Assistant needs a Doctor at the table. */
  readonly requiresRoleId: RoleId | null;
  readonly infection: { readonly whenTarget: InfectionBehavior; readonly whenSource: InfectionBehavior };
  readonly defaultProfileId: string;
  readonly profiles: Readonly<Record<string, AbilityProfile>>;
  readonly decisionIds: readonly string[];
}

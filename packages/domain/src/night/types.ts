import type { ActionPayload, ActionWindow, AbilityUse, UsePatch } from '../action/submission.js';
import type { RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition, AttackType, ProphetQuestion } from '../catalog/types.js';
import type { GameConfiguration } from '../config/types.js';
import type { Faction } from '../factions.js';
import type { LifeStatus } from '../game.js';
import type { AbilitySource, AbilityStatus, Capability, IndividualVictoryState } from '../roles.js';
import type { AbilityInstanceId, PlayerId, RoleId } from '../snapshot.js';

/**
 * Inputs and outputs of `resolveNight` (night-resolution.md). Everything
 * here is plain data: the API builds the input from rows and writes the
 * output back as rows.
 */

export interface NightPlayer {
  readonly id: PlayerId;
  readonly lifeStatus: LifeStatus;
}

export interface NightAssignment {
  readonly playerId: PlayerId;
  readonly currentRoleId: RoleId;
  readonly currentProfileId: string;
  readonly currentFaction: Faction;
  readonly wolfAligned: boolean;
  readonly individualVictory: IndividualVictoryState;
}

export interface NightAbility extends AbilityUse {
  readonly id: AbilityInstanceId;
  /** Defaults to NATIVE. Copies cannot be copied again, and are lost on infection (OD-31, OD-58). */
  readonly source?: AbilitySource;
}

/** A locked action. */
export interface NightAction {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly abilityInstanceId: AbilityInstanceId;
  readonly phase: ActionWindow;
  readonly targetPlayerIds: readonly PlayerId[];
  readonly payload: ActionPayload;
}

/** The host's choice in the confirm window (OD-01). Null when the host made none. */
export type HostKillDecision = { readonly kind: 'TARGET'; readonly playerId: PlayerId } | { readonly kind: 'NO_KILL' };

/**
 * Something an earlier resolution left on the table that outlives the night
 * it was made in:
 * - `SHIELD`: a Blacksmith item on its holder until it blocks a wolf kill or the holder dies (OD-16).
 * - `POISON`: a Poisoner's delayed poison, due at a later night or day (OD-28).
 * - `REVENGE`: an Avenger's revenge, due the next night (OD-13).
 */
export const NIGHT_EFFECT_KINDS = ['SHIELD', 'POISON', 'REVENGE', 'VAMPIRE_MARK', 'RETURNED', 'CHAOS_DAY'] as const;
export type NightEffectKind = (typeof NIGHT_EFFECT_KINDS)[number];

/** The six Ultimate 20 Chaos events. Day kinds are judged by `tallyDay`. */
export const CHAOS_KINDS = ['ABILITY_DISABLED', 'PROTECTIONS_OFF', 'NO_KILLS', 'NO_VOTE', 'SWAP_VOTES', 'DOUBLE_VOTE'] as const;
export type ChaosKind = (typeof CHAOS_KINDS)[number];

/** One draw from the Chaos pool. The API draws it; the resolver only applies it. */
export interface ChaosDraw {
  readonly kind: ChaosKind;
  readonly playerIds: readonly PlayerId[];
}

/** The two resolutions of a round. An effect lands in the night or the day of its `dueRound`. */
export const RESOLUTION_KINDS = ['NIGHT', 'DAY'] as const;
export type ResolutionKind = (typeof RESOLUTION_KINDS)[number];

export interface NightEffectSpec {
  readonly kind: NightEffectKind;
  readonly sourcePlayerId: PlayerId;
  readonly sourceAbilityInstanceId: AbilityInstanceId;
  readonly targetPlayerId: PlayerId;
  readonly createdRound: number;
  /** Null for a shield, which has no due time. */
  readonly dueRound: number | null;
  readonly duePhase: ResolutionKind | null;
  /** The attack type a POISON or REVENGE adds, or the types a SHIELD cancels. */
  readonly attackTypes: readonly AttackType[];
  /** Set on a CHAOS_DAY effect. */
  readonly chaosKind?: ChaosKind;
  /** Players the Chaos event named. */
  readonly playerIds?: readonly PlayerId[];
}

/** An effect still open at the start of the night. */
export interface NightEffect extends NightEffectSpec {
  readonly id: string;
}

/** `SPENT`: it landed or blocked. `EXPIRED`: its holder or target died first. */
export const EFFECT_STATUSES = ['ACTIVE', 'SPENT', 'EXPIRED'] as const;
export type EffectStatus = (typeof EFFECT_STATUSES)[number];
export type EffectClosure = Exclude<EffectStatus, 'ACTIVE'>;

export interface NightInput {
  readonly round: number;
  readonly config: GameConfiguration;
  readonly players: readonly NightPlayer[];
  readonly assignments: readonly NightAssignment[];
  readonly abilities: readonly NightAbility[];
  readonly actions: readonly NightAction[];
  readonly hostDecision: HostKillDecision | null;
  /** From the infection records: successes so far, and whether the Alpha's death has sealed infection (C-09). */
  readonly infection: { readonly successes: number; readonly sealed: boolean };
  /** Open effects. Defaults to none. */
  readonly effects?: readonly NightEffect[];
  /**
   * The Chaos Demon's draw for this night. Null when the demon did not act.
   * The resolver does not draw; `drawChaos` does, with the API's random source.
   */
  readonly chaos?: ChaosDraw | null;
  readonly catalog?: RoleCatalog;
}

/**
 * Why a locked action was rejected:
 * - `ABILITY_UNAVAILABLE`: the ability was revoked, or is not this actor's, by the time the window closed.
 * - `WRONG_PHASE`: the action belongs to a window this resolution does not cover, such as a day ability. Spends nothing.
 * - `TARGET_ILLEGAL`: a target was dead or unknown at close. Spends the attempt (night-resolution.md, section 7).
 * - `BLOCKED`: a Disruptor blocked the actor (step 2). Spends nothing (section 7).
 * - `NOT_IMPLEMENTED`: a capability or setting this build does not resolve. Spends nothing.
 */
export const ACTION_REJECTIONS = ['ABILITY_UNAVAILABLE', 'WRONG_PHASE', 'TARGET_ILLEGAL', 'BLOCKED', 'NOT_IMPLEMENTED', 'SUPERSEDED', 'REWOUND'] as const;
export type ActionRejection = (typeof ACTION_REJECTIONS)[number];

export interface ActionOutcome {
  readonly actionId: string;
  readonly status: 'RESOLVED' | 'REJECTED';
  readonly reason: ActionRejection | null;
}

/** Wolf or Non-Wolf, from the start-of-night state (OD-38). */
export type AlignmentResult = 'WOLF' | 'NOT_WOLF';

/** The Oracle's categories (OD-21). */
export const ROLE_CATEGORY_REPORTS = ['WOLF', 'VILLAGE_POWER', 'VILLAGE_BASIC', 'NEUTRAL', 'INDEPENDENT'] as const;
export type RoleCategoryReport = (typeof ROLE_CATEGORY_REPORTS)[number];

export interface Visit {
  readonly playerId: PlayerId;
  readonly capability: Capability | null;
}

/** One private fact for one actor and the host. Every value reads the start-of-night state, except tracking and traps. */
export type InformationValue =
  | { readonly kind: 'ALIGNMENT_WOLF_OR_NOT'; readonly value: AlignmentResult }
  | { readonly kind: 'ROLE_CATEGORY'; readonly value: RoleCategoryReport }
  | { readonly kind: 'ROLE_ID'; readonly value: RoleId }
  | { readonly kind: 'SAME_OR_DIFFERENT_FACTION'; readonly value: 'SAME' | 'DIFFERENT' }
  | { readonly kind: 'ROLE_AT_DEATH'; readonly value: RoleId }
  /** Distinct, sorted. `visits` carries the action types only when the configuration allows it (OD-27). */
  | { readonly kind: 'VISITED_PLAYER_IDS'; readonly value: readonly PlayerId[]; readonly visits: readonly Visit[] | null }
  | { readonly kind: 'YES_NO'; readonly value: boolean; readonly question: ProphetQuestion; readonly threshold: number }
  | { readonly kind: 'WOLF_KILL_SUBMISSION_COUNT'; readonly value: number }
  /** A triggered trap: every wolf whose kill named the trapped player, sorted (OD-15). */
  | { readonly kind: 'ATTACKER_IDS'; readonly value: readonly PlayerId[] }
  /** Fox: the target's current faction at the start of the night. */
  | { readonly kind: 'FACTION'; readonly value: Faction };

export type InvestigationResult = {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly abilityInstanceId: AbilityInstanceId;
  readonly abilityId: string;
  readonly targetPlayerIds: readonly PlayerId[];
} & InformationValue;

/** How an attack reached its victim. `PACK` attacks are anonymous: they name no single killer (OD-13). */
export type AttackVia = 'PACK' | 'ABILITY' | 'EFFECT' | 'REDIRECT';

export interface DeathCause {
  readonly type: AttackType;
  readonly via: AttackVia;
  /** Everyone who contributed: the pack wolves who named the victim, or the one named killer. Host and audit only. */
  readonly actorIds: readonly PlayerId[];
}

export interface Death {
  readonly playerId: PlayerId;
  /** In step order. */
  readonly causes: readonly AttackType[];
  /** The same causes with their contributors, for the elimination record. */
  readonly attackers: readonly DeathCause[];
  /** The current role when they died. Infection converts survivors only (OD-03). */
  readonly roleIdAtDeath: RoleId;
}

export interface Save {
  readonly playerId: PlayerId;
  readonly attackType: AttackType;
  /** Every ability that cancelled it. Redundant savers are all listed and all spend their use (OD-48). */
  readonly savedBy: readonly AbilityInstanceId[];
}

/** A Bodyguard took a wolf kill aimed at their protectee (step 8, OD-14). */
export interface Redirect {
  readonly fromPlayerId: PlayerId;
  readonly toPlayerId: PlayerId;
  readonly attackType: AttackType;
  readonly abilityInstanceId: AbilityInstanceId;
}

/** A Disruptor's block (step 2, OD-30). */
export interface Block {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
  /** The target's actions that were cancelled. Empty when the target submitted nothing. */
  readonly cancelledActionIds: readonly string[];
  /** Whether the blocked player is told (`informTarget` or the `informBlockedPlayer` toggle). */
  readonly informTarget: boolean;
}

export const INFECTION_FAILURES = ['ALPHA_DEAD', 'CAP_SUCCESS', 'CAP_SIZE', 'TARGET_DEAD', 'TARGET_INELIGIBLE', 'BLOCKED', 'SEALED', 'DISABLED'] as const;
export type InfectionFailure = (typeof INFECTION_FAILURES)[number];

export interface InfectionOutcome {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
  readonly outcome: 'SUCCESS' | 'FAILED';
  readonly reason: InfectionFailure | null;
}

/**
 * Reasons on `role_conversion_records` (data-model.md). Only INFECTION and
 * CURSED change a role today. Copies and inheritance hand over abilities,
 * not roles, so their record is the ability row (`source` COPY or INHERITED,
 * `source_player_id`); the other reasons are kept for permanent theft.
 */
export const CONVERSION_REASONS = ['INFECTION', 'CURSED', 'VAMPIRE', 'INHERIT', 'COPY_GRANT', 'COPY_EXPIRE'] as const;
export type ConversionReason = (typeof CONVERSION_REASONS)[number];

export interface Conversion {
  readonly playerId: PlayerId;
  readonly fromRoleId: RoleId;
  readonly fromFaction: Faction;
  readonly toRoleId: RoleId;
  readonly toProfileId: string;
  readonly toFaction: Faction;
  readonly wolfAligned: boolean;
  /** Set when the lost role had an individual victory (night-resolution.md, section 6). */
  readonly individualVictory: IndividualVictoryState | null;
  /** `INFECTION` from the Alpha (step 13), `CURSED` from a survived wolf attack (step 14), `VAMPIRE` from a due mark. */
  readonly cause: Extract<ConversionReason, 'INFECTION' | 'CURSED' | 'VAMPIRE'>;
}

/** A Cursed Villager who survived a wolf attack but stayed a villager, because the pack was full. */
export interface CursedFailure {
  readonly playerId: PlayerId;
  readonly reason: 'CAP_SIZE';
}

/** A new ability row: the Infected Wolf's kill, a Shapeshifter copy, or a Healer Assistant's inheritance. */
export interface AbilityGrant {
  readonly playerId: PlayerId;
  readonly abilityId: string;
  readonly definition: AbilityDefinition;
  readonly chargesRemaining: number | null;
  readonly availableFromRound: number;
  /** Copies expire after their configured nights (OD-31). Null for the rest. */
  readonly expiresRound: number | null;
  readonly source: AbilitySource;
  /** Whose ability was copied or inherited. Null for a native grant. */
  readonly sourcePlayerId: PlayerId | null;
}

/** A Shapeshifter's copy (step 15, OD-31). Empty `abilityIds` means nothing could be copied. */
export interface Copy {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
  readonly abilityIds: readonly string[];
}

/** A Healer Assistant took over a Doctor's save (step 15, OD-32). */
export interface Inheritance {
  readonly playerId: PlayerId;
  readonly fromPlayerId: PlayerId;
  readonly abilityIds: readonly string[];
}

/** An Avenger died tonight (step 16, OD-13). `targetId` is null when no single named killer exists, and the revenge is spent. */
export interface Revenge {
  readonly avengerId: PlayerId;
  readonly targetId: PlayerId | null;
}

/** An Assassin's night-1 mark, written on the assignment (OD-09). */
export interface Mark {
  readonly playerId: PlayerId;
  readonly targetId: PlayerId;
}

export interface AbilityUpdate {
  readonly abilityInstanceId: AbilityInstanceId;
  readonly patch: Partial<UsePatch> & { readonly status?: AbilityStatus; readonly revokedReason?: string };
}

export interface Rewind {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
  readonly removedActionIds: readonly string[];
}

/** A Chaos event that survived blocks and rewinds. `success: null` means the day tally judges it. */
export interface ChaosEvent {
  readonly actorId: PlayerId;
  readonly kind: ChaosKind;
  readonly playerIds: readonly PlayerId[];
  readonly success: boolean | null;
}

export interface Silence {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
}

/** The returned player stays DEAD. The effect is the only record that they were brought back. */
export interface Revival {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly targetId: PlayerId;
}

/** Host and audit see the sender. `publicFacts.hints` carries the text alone. */
export interface Hint {
  readonly actionId: string;
  readonly actorId: PlayerId;
  readonly text: string;
}

export interface NightResult {
  readonly round: number;
  /** The single pack target after aggregation, or null for no attack. */
  readonly finalWolfTarget: PlayerId | null;
  readonly deaths: readonly Death[];
  readonly saves: readonly Save[];
  readonly redirects: readonly Redirect[];
  readonly blocks: readonly Block[];
  readonly investigations: readonly InvestigationResult[];
  readonly infection: InfectionOutcome | null;
  readonly conversions: readonly Conversion[];
  readonly cursedFailures: readonly CursedFailure[];
  readonly copies: readonly Copy[];
  readonly inheritances: readonly Inheritance[];
  readonly revenges: readonly Revenge[];
  readonly marks: readonly Mark[];
  readonly rewinds: readonly Rewind[];
  readonly chaosEvent: ChaosEvent | null;
  readonly silences: readonly Silence[];
  readonly revivals: readonly Revival[];
  readonly hints: readonly Hint[];
  readonly grants: readonly AbilityGrant[];
  readonly abilityUpdates: readonly AbilityUpdate[];
  /** Effects made tonight: shields that did not block yet, delayed poisons, and queued revenge. */
  readonly newEffects: readonly NightEffectSpec[];
  /** Open effects that closed tonight. */
  readonly closedEffects: readonly { readonly effectId: string; readonly status: EffectClosure }[];
  readonly actions: readonly ActionOutcome[];
  readonly infectionState: { readonly successes: number; readonly sealed: boolean };
  /** Facts every seat may see. Never infection, investigations, submissions, blocks, or unused protections. */
  readonly publicFacts: {
    readonly deaths: readonly { readonly playerId: PlayerId; readonly revealedRoleId: RoleId | null }[];
    /** Only when the configuration announces infections (OD-44). Never says who. */
    readonly infectionAnnounced: boolean;
    /** Ghost hints, text only. The sender is on `hints`, for the host. */
    readonly hints: readonly { readonly text: string }[];
    /** Players silenced for the next day. */
    readonly silenced: readonly PlayerId[];
    /** Players the Necromancer returned. They are still dead. */
    readonly returned: readonly PlayerId[];
  };
}

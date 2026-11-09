import type { Faction } from '../factions.js';
import type { GameMode } from '../game.js';
import type { AbilityId, RoleId } from '../snapshot.js';

/**
 * A game configuration: the host's lobby draft, and after start the frozen
 * snapshot. See docs/werewolf/role-configuration.md, section 1.
 */

export const KILL_AGGREGATIONS = ['HOST_SELECT_AMONG_SUBMISSIONS', 'MAJORITY', 'ALPHA_PRIORITY'] as const;
export type KillAggregation = (typeof KILL_AGGREGATIONS)[number];

export const NIGHT_PROFILES = ['infection-v1', 'classic-v1', 'custom-v1'] as const;
export type NightProfile = (typeof NIGHT_PROFILES)[number];

export type InfectionEligibility = 'VILLAGE_ONLY' | 'ANY_NON_PACK_WOLF';
export type RevealSetting = 'CURRENT_ROLE' | 'HIDDEN';

/** Narrowing changes to an ability the role already has. Overrides cannot add a mechanic. */
export interface AbilityOverride {
  readonly usesPerGame?: number | null;
  readonly usesPerPhase?: number | null;
  readonly cooldownNights?: number;
  /** Only keys the ability already defines, with a value of the same type. */
  readonly config?: Readonly<Record<string, string | number | boolean>>;
}

export interface RoleEntry {
  readonly roleId: RoleId;
  readonly count: number;
  /** Required for roles that must declare one. Defaults to the role's default faction otherwise. */
  readonly faction?: Faction;
  /** Defaults to the role's default profile. */
  readonly abilityProfile?: string;
  readonly overrides?: Readonly<Record<AbilityId, AbilityOverride>>;
}

export interface GameConfiguration {
  readonly version: 1;
  readonly mode: GameMode;
  /** Source preset id, or `custom`. */
  readonly rolePackId: string;
  readonly playerCount: number;
  readonly pacing: 'HOST' | 'TIMED';
  /** Used when pacing is TIMED. */
  readonly timers: { readonly nightSeconds: number; readonly daySeconds: number; readonly voteSeconds: number } | null;
  /** Reaching it with no terminal victory is a draw (OD-52). */
  readonly roundCap: number;
  /** Open-decision id to the accepted value, such as `{ "OD-01": "HOST_SELECT_AMONG_SUBMISSIONS" }`. */
  readonly rulesetAcknowledgments: Readonly<Record<string, string>>;
  readonly teams: {
    /** Maximum WOLF_PACK size after conversions. */
    readonly wolfCap: number;
    readonly allowMultipleWinners: boolean;
    /** Optional faction totals the host expects. Compared with the derived totals. */
    readonly targets?: Readonly<Partial<Record<Faction, number>>>;
  };
  readonly wolves: {
    readonly knowsTeammates: boolean;
    readonly friendlyFire: boolean;
    readonly killAggregation: KillAggregation;
  };
  readonly infection: {
    readonly enabled: boolean;
    readonly maxSuccesses: number;
    readonly attemptsPerNight: number;
    readonly eligibility: InfectionEligibility;
    /** OD-03: infection sticks only if the target survives the night. */
    readonly requiresSurvival: boolean;
    readonly announcement: 'SILENT' | 'PUBLIC';
    readonly blockedByGuard: boolean;
    readonly blockedByDoctor: boolean;
    readonly alphaDeath: 'SEAL';
    readonly grantKillNextNight: boolean;
  };
  readonly roles: readonly RoleEntry[];
  readonly voting: {
    readonly enabled: boolean;
    readonly abstain: boolean;
    readonly changeUntilClose: boolean;
    readonly deadMayVote: boolean;
    readonly tie: 'REVOTE_THEN_NONE';
    readonly revealOnDayElimination: RevealSetting;
    readonly revealOnNightDeath: RevealSetting;
  };
  readonly night: {
    readonly profile: NightProfile;
    readonly toggles: {
      readonly protectionBlocksPoison: boolean;
      readonly bodyguardRedirectsPoison: boolean;
      readonly copyInformedDoctor: boolean;
      readonly informBlockedPlayer: boolean;
      readonly trackerIncludesActionType: boolean;
    };
  };
  /** OD-54: the host cannot adjudicate. Present so a draft that tries is rejected explicitly. */
  readonly allowHostAdjudication: boolean;
}

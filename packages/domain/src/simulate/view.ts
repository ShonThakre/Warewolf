import type { AbilityDefinition, TargetRule } from '../catalog/types.js';
import type { Faction } from '../factions.js';
import type { GamePhase, LifeStatus } from '../game.js';
import type { AbilityStatus } from '../roles.js';
import type { PlayerId } from '../snapshot.js';
import type { ActionPayload } from '../action/submission.js';

/**
 * What one seat may see (WW-1401). No other seat's role is on this object.
 * The harness builds it; a policy is not given the table.
 */
export interface SeatProjection {
  readonly selfId: PlayerId;
  readonly isHost: boolean;
  readonly lifeStatus: LifeStatus;
  readonly roleId: string;
  readonly faction: Faction;
  readonly round: number;
  readonly phase: GamePhase;
  readonly window: 'NIGHT_SUBMIT' | 'NIGHT_REACTION' | 'KILL' | 'VOTE';
  readonly abilities: readonly ProjectedAbility[];
  /** Public life only. */
  readonly seats: readonly { readonly id: PlayerId; readonly lifeStatus: LifeStatus }[];
  /** Facts this seat was told on earlier nights. */
  readonly ownResults: readonly { readonly round: number; readonly kind: string; readonly value: unknown }[];
  /** Host kill confirm: the submitted target ids, not who submitted them. Null otherwise. */
  readonly killCandidates: readonly PlayerId[] | null;
  /** Informed reaction: the final wolf target, or null when there is no attack. Omitted for everyone else. */
  readonly finalWolfTarget?: PlayerId | null;
  /** Legal vote targets for this seat. Null is an abstention, included only when the rules allow it. */
  readonly voteTargets: readonly (PlayerId | null)[];
}

export interface ProjectedAbility {
  readonly id: string;
  readonly abilityId: string;
  readonly status: AbilityStatus;
  readonly chargesRemaining: number | null;
  readonly usesConsumed: number;
  readonly lastUsedRound: number | null;
  readonly lastTargetPlayerId: PlayerId | null;
  readonly availableFromRound: number;
  readonly expiresRound: number | null;
  readonly config: AbilityDefinition;
}

export type BotAction = {
  readonly abilityInstanceId: string;
  readonly targetPlayerIds: readonly PlayerId[];
  readonly payload: ActionPayload;
};

export type BotChoice =
  | { readonly kind: 'ACTIONS'; readonly actions: readonly BotAction[] }
  | { readonly kind: 'KILL'; readonly targetPlayerId: PlayerId | null }
  | { readonly kind: 'VOTE'; readonly targetPlayerId: PlayerId | null };

export type { TargetRule };

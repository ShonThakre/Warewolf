import type { TargetRuleDto } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';

/**
 * Sentences for the day ballot (WEB-08). Living players choose one living
 * seat, including their own, or abstain. The server still checks both.
 */

/** One living player. Self is allowed: the vote route accepts it. */
export const VOTE_TARGET_RULE: TargetRuleDto = {
  kind: 'PLAYERS',
  count: 1,
  life: 'ALIVE',
  self: true,
  notSameAsLastRound: false,
};

export type VoteChoice = { readonly kind: 'player'; readonly playerId: string } | { readonly kind: 'abstain' };

/** A living player during voting or the revote. */
export function canCastBallot(you: { readonly lifeStatus: string }, phase: GamePhase): boolean {
  return you.lifeStatus === 'ALIVE' && (phase === 'VOTING' || phase === 'REVOTE');
}

export function voteMatches(choice: VoteChoice | null, storedTarget: string | null | undefined): boolean {
  if (!choice || storedTarget === undefined) return false;
  return choice.kind === 'abstain' ? storedTarget === null : storedTarget === choice.playerId;
}

/** The action row. A stored choice can still be replaced until the phase closes. */
export function voteRowText(options: {
  readonly phase: GamePhase;
  readonly canVote: boolean;
  readonly choice: VoteChoice | null;
  readonly name: string | null;
  readonly stored: boolean;
}): string {
  if (!options.canVote) return 'You cannot vote.';
  if (!options.choice) {
    return options.phase === 'REVOTE' ? 'Choose one of the tied players, or abstain.' : 'Choose a player to eliminate, or abstain.';
  }
  if (options.choice.kind === 'abstain') {
    return options.stored ? 'Submitted. You abstained. You can change it until voting closes.' : 'Abstain.';
  }
  const name = options.name ?? 'that player';
  return options.stored ? `Submitted. Your vote is ${name}. You can change it until voting closes.` : name;
}

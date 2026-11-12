import type { DayTally, TargetRuleDto } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';

/**
 * Sentences for the day ballot (WEB-08). Living players choose one living
 * seat, including their own, or abstain when the room allows it. The server
 * still checks both. The table reads `GameState.voting`. Null means a caller
 * has not been given those flags yet.
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

/** Room voting rules when the client knows them. Null means unknown. */
export type VoteRules = {
  readonly canAbstain: boolean | null;
  readonly canChange: boolean | null;
};

export const UNKNOWN_VOTE_RULES: VoteRules = { canAbstain: null, canChange: null };

/** A living player during voting or the revote. */
export function canCastBallot(you: { readonly lifeStatus: string }, phase: GamePhase): boolean {
  return you.lifeStatus === 'ALIVE' && (phase === 'VOTING' || phase === 'REVOTE');
}

export function voteMatches(choice: VoteChoice | null, storedTarget: string | null | undefined): boolean {
  if (!choice || storedTarget === undefined) return false;
  return choice.kind === 'abstain' ? storedTarget === null : storedTarget === choice.playerId;
}

/**
 * The revote's legal targets: the tied leaders of this round's first ballot,
 * from the public tally. Null outside a revote, or before that tally has loaded,
 * in which case the server's check is the only one.
 */
export function revoteTargets(phase: GamePhase, roundNumber: number, tallies: readonly DayTally[]): ReadonlySet<string> | null {
  if (phase !== 'REVOTE') return null;
  const first = tallies.find((tally) => tally.roundNumber === roundNumber && tally.ballot === 1);
  if (!first || first.tiedPlayerIds.length === 0) return null;
  return new Set(first.tiedPlayerIds);
}

function changeHint(canChange: boolean | null): string {
  if (canChange === false) return 'This ballot is locked.';
  if (canChange === true) return 'You can change it until voting closes.';
  return 'The host settings decide whether you can change it.';
}

/** The action row. Selecting and sending are separate steps, and the row says which one happened. */
export function voteRowText(options: {
  readonly phase: GamePhase;
  readonly canVote: boolean;
  readonly choice: VoteChoice | null;
  readonly name: string | null;
  readonly stored: boolean;
  readonly rules?: VoteRules;
}): string {
  const rules = options.rules ?? UNKNOWN_VOTE_RULES;
  const abstainOk = rules.canAbstain !== false;
  if (!options.canVote) return 'You cannot vote.';
  if (!options.choice) {
    if (options.phase === 'REVOTE') {
      return abstainOk ? 'Choose one of the tied players, or abstain.' : 'Choose one of the tied players.';
    }
    return abstainOk ? 'Choose a player to eliminate, or abstain.' : 'Choose a player to eliminate.';
  }
  if (options.choice.kind === 'abstain') {
    return options.stored ? `Vote sent. You abstained. ${changeHint(rules.canChange)}` : 'Abstain selected: your ballot counts for nobody. Not sent yet.';
  }
  const name = options.name ?? 'that player';
  return options.stored ? `Vote sent. Your vote is ${name}. ${changeHint(rules.canChange)}` : `Selected: ${name}. Not sent yet.`;
}

/** The confirm button: first send, then a change once a ballot is stored and the room allows it. */
export function voteButtonLabel(options: {
  readonly hasStored: boolean;
  readonly stored: boolean;
  readonly casting: boolean;
  readonly canChange?: boolean | null;
}): string {
  if (options.casting) return 'Sending…';
  if (options.stored) return 'Vote sent';
  if (options.hasStored && options.canChange === false) return 'Vote locked';
  return options.hasStored ? 'Change vote' : 'Confirm vote';
}

/** Whether the abstain control should show. Unknown defaults to showing; the server refuses if needed. */
export function showAbstain(rules: VoteRules = UNKNOWN_VOTE_RULES): boolean {
  return rules.canAbstain !== false;
}

/** Whether a new selection can replace a stored ballot. Unknown defaults to allowing the attempt. */
export function canChangeVote(rules: VoteRules = UNKNOWN_VOTE_RULES, hasStored: boolean): boolean {
  if (!hasStored) return true;
  return rules.canChange !== false;
}

import type { DayTally } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';

/**
 * Words for the public tally (WW-904b, OD-85). Counts appear only after a
 * ballot closes. Abstentions are a word. Who voted for whom is never shown.
 */

const OPEN_BALLOT: ReadonlySet<GamePhase> = new Set(['VOTING']);

/** The tally to show now. An open ballot hides every count, including earlier days. */
export function shownTally(phase: GamePhase, latest: DayTally | null): DayTally | null {
  if (!latest || OPEN_BALLOT.has(phase)) return null;
  return latest;
}

export function tallyTitle(tally: DayTally): string {
  return tally.ballot === 2 ? 'Revote' : 'Vote';
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'A player';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

/** The one-line result. A first tie names the revote. A second tie names nobody. */
export function tallyResult(tally: DayTally, nameOf: (playerId: string) => string): string {
  const tied = tally.tiedPlayerIds.map(nameOf);
  if (tally.votedOutPlayerId) return `${nameOf(tally.votedOutPlayerId)} was named.`;
  if (tally.ballot === 2) return tied.length > 1 ? `Nobody was eliminated. ${joinNames(tied)} tied.` : 'Nobody was eliminated.';
  if (tied.length > 1) return `Revote between ${joinNames(tied)}.`;
  return 'Nobody was named.';
}

export function abstentionLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 abstention' : `${count} abstentions`;
}

import type { FinishedResults, ResultSeat } from '@warewolf/contracts';
import { DEFAULT_CATALOG, type Faction } from '@warewolf/domain';
import type { VictoryOutcome } from './VictoryBanner';
import { converted, resultsHeadline, type ResultsHeadline } from '../state/results';

/**
 * Words for the results screen (WW-903). Role ids stay in the data.
 * The screen shows catalog names, and a team colour always comes with its word.
 * Closed ballots are the public tally (OD-85). Who voted for whom is not listed.
 */

const TEAM_WORD: Record<Faction, string> = {
  VILLAGE: 'Village',
  WOLF_PACK: 'Wolf',
  NEUTRAL: 'Neutral',
  INDEPENDENT: 'Independent',
};

const TEAM_CLASS: Record<Faction, string> = {
  VILLAGE: 'ww-team ww-team-village',
  WOLF_PACK: 'ww-team ww-team-wolf',
  NEUTRAL: 'ww-team ww-team-neutral',
  INDEPENDENT: 'ww-team ww-team-independent',
};

export function teamWord(faction: Faction): string {
  return TEAM_WORD[faction];
}

export function teamClass(faction: Faction): string {
  return TEAM_CLASS[faction];
}

/** A catalog name. An id the catalog does not know stays "A role". */
export function roleLabel(roleId: string): string {
  return DEFAULT_CATALOG.byId.get(roleId)?.displayName ?? 'A role';
}

export function resultsTitle(headline: ResultsHeadline): string {
  if (headline.kind === 'DRAW') return 'Draw';
  if (headline.kind === 'INDIVIDUALS') return 'Individual wins';
  return `${teamWord(headline.team)} wins`;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** One sentence for the banner. Individual winners are named. Duration is not invented. */
export function resultsReason(results: FinishedResults): string {
  const headline = resultsHeadline(results);
  const alone = results.seats.filter((seat) => seat.individualWin).map((seat) => seat.displayName);
  const aloneLine = alone.length > 0 ? `${joinNames(alone)} won on their own.` : null;
  const ended = `Ended in round ${results.roundNumber}.`;
  if (headline.kind === 'DRAW') return [aloneLine ?? 'The table drew.', ended].join(' ');
  if (headline.kind === 'TEAM') return [`The ${teamWord(headline.team)} team wins.`, aloneLine, ended].filter((part): part is string => part != null).join(' ');
  return [aloneLine ?? 'No team won.', ended].join(' ');
}

/** Scene and ribbon. A lone-wolf win uses that ribbon only when every individual winner held that role. */
export function bannerOutcome(results: FinishedResults): VictoryOutcome {
  const headline = resultsHeadline(results);
  if (headline.kind === 'DRAW') return 'draw';
  if (headline.kind === 'TEAM') {
    if (headline.team === 'VILLAGE') return 'village';
    if (headline.team === 'WOLF_PACK') return 'wolves';
    return 'neutral';
  }
  const winners = results.seats.filter((seat) => seat.individualWin);
  if (winners.length > 0 && winners.every((seat) => seat.finalRoleId === 'lone_wolf')) return 'lone-wolf';
  return 'neutral';
}

export interface ResultStats {
  readonly rounds: number;
  readonly infections: number;
  readonly eliminations: number;
}

export function resultStats(results: FinishedResults): ResultStats {
  return {
    rounds: results.roundNumber,
    infections: results.infections.length,
    eliminations: results.seats.filter((seat) => seat.death != null).length,
  };
}

/** Original and final names. One name when the role did not change. */
export function seatRoles(seat: ResultSeat): string {
  const finalName = roleLabel(seat.finalRoleId);
  if (!converted(seat)) return finalName;
  return `Started as ${roleLabel(seat.originalRoleId)}. Ended as ${finalName}.`;
}

export function deathLine(seat: ResultSeat): string | null {
  if (!seat.death) return null;
  const when = seat.death.phaseKind === 'NIGHT' ? 'at night' : 'by the day vote';
  return `Eliminated ${when}, round ${seat.death.roundNumber}.`;
}

export function usesLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? 'Used 1 ability.' : `Used ${count} abilities.`;
}

export function infectionLine(results: FinishedResults, infection: FinishedResults['infections'][number]): string {
  const name = (playerId: string) => results.seats.find((seat) => seat.playerId === playerId)?.displayName ?? 'A player';
  return `${name(infection.sourcePlayerId)} infected ${name(infection.targetPlayerId)} on night ${infection.roundNumber}.`;
}

export function cancelReasonCopy(reason: 'HOST' | 'SURRENDER'): string {
  const why = reason === 'HOST' ? 'The host cancelled the game.' : 'The table surrendered.';
  return `${why} Roles stay hidden.`;
}

/** Names of seats that won on their own, in seat order. Empty when nobody did. */
export function individualWinnerNames(results: FinishedResults): readonly string[] {
  return results.seats.filter((seat) => seat.individualWin).map((seat) => seat.displayName);
}

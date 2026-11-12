import { skipToken } from '@reduxjs/toolkit/query/react';
import type { CancelledResults, FinishedResults, ResultSeat } from '@warewolf/contracts';
import type { Faction, GameStatus } from '@warewolf/domain';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetResultsQuery } from '../../api/results';
import { useSeat } from './lobby';

/**
 * The results screen's data (WW-903a, for WW-903 and the recap in WW-1203).
 * Pass `state.status` from `useGameState`. Nothing is asked until the game
 * has finished or been cancelled, so a running game never requests a recap.
 */

export interface ResultsState {
  /** Set once a finished game's recap has loaded. Every seat's roles are in it. */
  readonly finished: FinishedResults | null;
  /** Set once a cancelled game's recap has loaded. It has seats and the reason, never a role. */
  readonly cancelled: CancelledResults | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

export function useResults(status: GameStatus | undefined): ResultsState {
  const seat = useSeat();
  const ended = status === 'FINISHED' || status === 'CANCELLED';
  const query = useGetResultsQuery(ended && seat ? seat.gameId : skipToken);
  const data = ended ? query.data : undefined;
  return {
    finished: data?.status === 'FINISHED' ? data : null,
    cancelled: data?.status === 'CANCELLED' ? data : null,
    isLoading: ended && query.isLoading,
    error: ended ? apiErrorOf(query.error) : null,
    refetch: () => void query.refetch(),
  };
}

/** Banner wording input. Team colour always comes with this word (design system rule). */
export type ResultsHeadline = { kind: 'TEAM'; team: Faction } | { kind: 'DRAW' } | { kind: 'INDIVIDUALS' };

export function resultsHeadline(results: FinishedResults): ResultsHeadline {
  if (results.winningTeam) return { kind: 'TEAM', team: results.winningTeam };
  if (results.draw) return { kind: 'DRAW' };
  return { kind: 'INDIVIDUALS' };
}

/** Winners first, then seat order, for the recap list. */
export function recapOrder(seats: readonly ResultSeat[]): ResultSeat[] {
  return [...seats].sort((a, b) => Number(b.won) - Number(a.won) || a.seatNumber - b.seatNumber);
}

/** True when the seat's role changed during the game, for example by infection. */
export function converted(seat: ResultSeat): boolean {
  return seat.originalRoleId !== seat.finalRoleId || seat.originalFaction !== seat.finalFaction;
}

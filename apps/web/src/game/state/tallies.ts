import { skipToken } from '@reduxjs/toolkit/query/react';
import type { DayTally } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { useEffect, useRef } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetTalliesQuery } from '../../api/tallies';
import { useSeat } from './lobby';

/**
 * The public vote tallies (WW-904, OD-85), for the table and the recap.
 * A ballot's counts exist only once it has closed, and every close bumps
 * `stateVersion`, so the hook reads again on a new version. Counts are
 * never shown while a ballot is open.
 */

export interface DayTalliesState {
  /** Every closed ballot, oldest first. */
  readonly tallies: readonly DayTally[];
  /** The most recent closed ballot, or null before the first vote closes. */
  readonly latest: DayTally | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
}

const NONE: readonly DayTally[] = [];

/** Pass the phase and `stateVersion` from `useGameState`. Nothing is asked in the lobby. */
export function useDayTallies(phase: GamePhase | undefined, stateVersion: number | undefined): DayTalliesState {
  const seat = useSeat();
  const enabled = Boolean(seat && phase && phase !== 'LOBBY');
  const query = useGetTalliesQuery(enabled && seat ? seat.gameId : skipToken);
  const { refetch } = query;
  const seen = useRef(stateVersion);
  useEffect(() => {
    if (!enabled || stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    void refetch();
  }, [enabled, stateVersion, refetch]);

  const tallies = enabled ? (query.data?.tallies ?? NONE) : NONE;
  return {
    tallies,
    latest: tallies.at(-1) ?? null,
    isLoading: enabled && query.isLoading,
    error: enabled ? apiErrorOf(query.error) : null,
  };
}

/** Total weight cast, abstentions excluded. For bar widths in the tally view. */
export function tallyTotal(tally: DayTally): number {
  return tally.counts.reduce((sum, c) => sum + c.total, 0);
}

/** The tallies of one round, first ballot then revote. */
export function talliesOfRound(tallies: readonly DayTally[], roundNumber: number): DayTally[] {
  return tallies.filter((t) => t.roundNumber === roundNumber);
}

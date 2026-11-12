import { skipToken } from '@reduxjs/toolkit/query/react';
import type { HostDashboard } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { useEffect, useRef } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetHostDashboardQuery } from '../../api/hostDashboard';
import { useSeat } from './lobby';

/**
 * The host dashboard's data (WW-1202a, for the WW-1202 screen). A guest
 * never sends the request.
 *
 * Phase changes bump `stateVersion`, so a new version reads it again.
 * Submissions and votes arrive without a version change, so while a
 * submission window or a ballot is open the hook also polls.
 */

/** Phases in which players change what the dashboard shows without a phase change. */
const LIVE = new Set<GamePhase>(['NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'VOTING', 'REVOTE']);
export const DASHBOARD_POLL_MS = 4_000;

export interface HostDashboardState {
  /** Null for a guest, in the lobby, and until loaded. */
  readonly dashboard: HostDashboard | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/** Pass the phase and `stateVersion` from `useGameState`. */
export function useHostDashboard(phase: GamePhase | undefined, stateVersion: number | undefined): HostDashboardState {
  const seat = useSeat();
  const enabled = Boolean(seat?.isHost && phase && phase !== 'LOBBY');
  const query = useGetHostDashboardQuery(enabled && seat ? seat.gameId : skipToken, {
    pollingInterval: enabled && phase && LIVE.has(phase) ? DASHBOARD_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const { refetch } = query;
  const seen = useRef(stateVersion);
  useEffect(() => {
    if (!enabled || stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    void refetch();
  }, [enabled, stateVersion, refetch]);

  return {
    dashboard: enabled ? (query.data ?? null) : null,
    isLoading: enabled && query.isLoading,
    error: enabled ? apiErrorOf(query.error) : null,
    refetch: () => void refetch(),
  };
}

/** Display name and seat for an id, for every section that lists players by id. */
export function dashboardSeat(dashboard: HostDashboard, playerId: string | null) {
  if (playerId === null) return null;
  return dashboard.roster.players.find((p) => p.playerId === playerId) ?? null;
}

/** The ballot the table is voting on now, or null. */
export function openBallot(dashboard: HostDashboard) {
  return dashboard.ballots.find((b) => b.open) ?? null;
}

/** The wolves' kill choices this round: the pack submissions the host confirms from. */
export function wolfSubmissions(dashboard: HostDashboard) {
  const wolves = new Set(dashboard.roster.players.filter((p) => p.wolfAligned).map((p) => p.playerId));
  return dashboard.submissions.filter((s) => wolves.has(s.playerId));
}

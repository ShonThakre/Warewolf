import { skipToken } from '@reduxjs/toolkit/query/react';
import type { HostRoster, MyRole, OwnAbility } from '@warewolf/contracts';
import type { GamePhase, GameStatus } from '@warewolf/domain';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetHostRosterQuery, useGetMyRoleQuery } from '../../api/game';
import { useCallback, useEffect, useRef } from 'react';
import { useSeat } from './lobby';
import { usePrivateEvents } from './realtime';

/**
 * Hooks and helpers for the reveal screen, the role modal, and the host
 * roster (WW-404a). Screens never fetch or cache a role themselves.
 */

export interface MyRoleState {
  /** Null until loaded, when there is no seat, and before the deal. */
  readonly role: MyRole | null;
  readonly isLoading: boolean;
  /** PHASE_CONFLICT means the game has not started; send the player to the lobby. */
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/** Private events that mean this seat's role just changed. */
export const ROLE_CHANGE_EVENTS: readonly string[] = ['ROLE_CONVERTED', 'INFECTION_OCCURRED'];

/**
 * The signed-in seat's own role, from GET /games/:gameId/me. Fetched fresh on
 * mount and on window focus, never restored from storage (ui-ux-plan.md, section 8).
 *
 * Pass the `stateVersion` from `useGameState` on screens that stay open across
 * phases, such as the table: a role can change at night (infection, Cursed,
 * a Vampire mark), so the hook refetches when the version moves and when the
 * seat's own conversion event arrives.
 */
export function useMyRole(stateVersion?: number): MyRoleState {
  const seat = useSeat();
  const query = useGetMyRoleQuery(seat?.gameId ?? skipToken, { refetchOnFocus: true });
  const { refetch } = query;
  const hasSeat = Boolean(seat);
  const seen = useRef(stateVersion);
  useEffect(() => {
    if (stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    if (hasSeat) void refetch();
  }, [stateVersion, hasSeat, refetch]);
  const onChange = useCallback(() => void refetch(), [refetch]);
  usePrivateEvents(ROLE_CHANGE_EVENTS, stateVersion === undefined ? null : onChange);
  return {
    role: seat ? (query.data ?? null) : null,
    isLoading: query.isLoading,
    error: apiErrorOf(query.error),
    refetch: () => void query.refetch(),
  };
}

export interface HostRosterState {
  /** Null for anyone but the host, until loaded, and before the deal. */
  readonly roster: HostRoster | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/** Every seat's role, for the host only. A non-host never sends the request. */
export function useHostRoster(): HostRosterState {
  const seat = useSeat();
  const query = useGetHostRosterQuery(seat?.isHost ? seat.gameId : skipToken, { refetchOnFocus: true });
  return {
    roster: seat?.isHost ? (query.data ?? null) : null,
    isLoading: query.isLoading,
    error: apiErrorOf(query.error),
    refetch: () => void query.refetch(),
  };
}

/**
 * The route a seated player belongs on for a game's status and phase.
 * A cancelled game uses the results screen, which lists seats and the reason.
 *
 * The reveal is shown while the game is in ROLE_REVEAL. Its "I understand"
 * goes to the table, and the table does not send the player back.
 */
export function gamePath(gameId: string, status: GameStatus, phase: GamePhase): string | null {
  switch (status) {
    case 'LOBBY':
      return `/lobby/${gameId}`;
    case 'ACTIVE':
      return phase === 'ROLE_REVEAL' ? `/game/${gameId}/reveal` : `/game/${gameId}`;
    case 'FINISHED':
      return `/game/${gameId}/results`;
    case 'CANCELLED':
      return `/game/${gameId}/results`;
  }
}

const NIGHT_TIMINGS: readonly OwnAbility['timing'][] = ['NIGHT', 'NIGHT_REACTION'];

/**
 * The abilities the player may use on the night of `round`, judged from the
 * dealt limits: timing, first round, a single allowed round, expiry, and uses
 * left. Cooldowns and target rules are checked by the server when the action
 * is sent (Phase 6). The reveal card uses this for its line about tonight, or
 * "You have no night action" when it is empty.
 */
export function nightAbilitiesForRound(role: Pick<MyRole, 'abilities'>, round: number): OwnAbility[] {
  return role.abilities.filter(
    (a) =>
      NIGHT_TIMINGS.includes(a.timing) &&
      a.status === 'ACTIVE' &&
      a.usesRemaining !== 0 &&
      round >= a.availableFromRound &&
      (a.onlyRound === null || a.onlyRound === round) &&
      (a.expiresRound === null || round <= a.expiresRound),
  );
}

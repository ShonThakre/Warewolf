import { skipToken } from '@reduxjs/toolkit/query/react';
import type { KillTargetView, SetKillTargetRequest } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { useCallback, useEffect, useRef } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetKillTargetQuery, useSetKillTargetMutation } from '../../api/killTarget';
import { useSeat } from './lobby';

/**
 * Hooks for the host's kill confirmation (WW-803a, for WW-803b). Screens
 * never fetch this view. A non-host never sends the request: the payload
 * names which wolf chose which player.
 *
 * The informed Doctor does not use these hooks. Their target is
 * `finalWolfTarget` on the save row from `useMyActions` / `actionPrompts`,
 * and only while that ability is open in the reaction window.
 */

/** Phases in which the server will return the view. Other phases are not asked. */
const READABLE = new Set<GamePhase>(['NIGHT_HOST_CONFIRM', 'NIGHT_REACTION']);

export interface KillTargetState {
  /** Null until loaded, for a non-host, and outside host confirm and the reaction window. */
  readonly view: KillTargetView | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/**
 * The host's candidates and current choice. Pass the phase and `stateVersion`
 * from `useGameState`. The choice can change without a version bump, so a
 * successful `useSetKillTarget` refreshes this query itself.
 */
export function useKillTarget(phase: GamePhase | undefined, stateVersion: number | undefined): KillTargetState {
  const seat = useSeat();
  const open = Boolean(seat?.isHost && phase && READABLE.has(phase));
  const query = useGetKillTargetQuery(open && seat ? seat.gameId : skipToken, { refetchOnFocus: true });
  const seen = useRef(stateVersion);
  const { refetch } = query;
  useEffect(() => {
    if (!open || stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    void refetch();
  }, [open, stateVersion, refetch]);

  return {
    view: open ? (query.data ?? null) : null,
    isLoading: open && query.isLoading,
    error: open ? apiErrorOf(query.error) : null,
    refetch: () => void query.refetch(),
  };
}

export interface SetKillTargetControl {
  /** Resolves to the stored view, or null when refused. Read `error` for why. */
  readonly choose: (choice: SetKillTargetRequest) => Promise<KillTargetView | null>;
  readonly isChoosing: boolean;
  /** KILL_TARGET_NOT_SUBMITTED means no wolf named that player. The message is safe to show. */
  readonly error: ApiErrorInfo | null;
}

/** Host only. One submitted player, or `{ noKill: true }`. A later choice replaces the earlier one until the phase closes. */
export function useSetKillTarget(): SetKillTargetControl {
  const seat = useSeat();
  const [trigger, result] = useSetKillTargetMutation();

  const choose = useCallback(
    async (choice: SetKillTargetRequest) => {
      if (!seat?.isHost) return null;
      const outcome = await trigger({ gameId: seat.gameId, ...choice });
      return 'data' in outcome && outcome.data ? outcome.data : null;
    },
    [seat, trigger],
  );

  return { choose, isChoosing: result.isLoading, error: apiErrorOf(result.error) };
}

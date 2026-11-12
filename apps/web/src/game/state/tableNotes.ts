import { skipToken } from '@reduxjs/toolkit/query/react';
import type { GamePhase } from '@warewolf/domain';
import { useEffect, useRef } from 'react';
import { useGetEventsQuery } from '../../api/events';
import { tableNote } from '../components/tableNotes';
import { useSeat } from './lobby';

/**
 * The signed-in seat's table report (WW-1001). The request is the same
 * event list the seat may already read. Host-only copies are dropped here,
 * so a source or another player's result never reaches the table.
 */

type Named = { readonly playerId: string; readonly displayName: string };

export function useTableNotes(
  phase: GamePhase | undefined,
  stateVersion: number | undefined,
  youId: string | undefined,
  players: readonly Named[] | undefined,
): readonly string[] {
  const seat = useSeat();
  const enabled = Boolean(seat && youId && phase && phase !== 'LOBBY');
  const query = useGetEventsQuery(enabled && seat ? { gameId: seat.gameId, afterSeq: 0 } : skipToken);
  const { refetch } = query;
  const seen = useRef(stateVersion);
  useEffect(() => {
    if (!enabled || stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    void refetch();
  }, [enabled, stateVersion, refetch]);

  if (!enabled || !youId) return [];
  const nameOf = (playerId: string) => players?.find((player) => player.playerId === playerId)?.displayName ?? 'A player';
  const lines = (query.data?.events ?? []).map((event) => tableNote(event, youId, nameOf)).filter((line): line is string => line !== null);
  return [...new Set(lines)];
}

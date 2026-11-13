import { skipToken } from '@reduxjs/toolkit/query/react';
import type { GamePhase } from '@warewolf/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useGetEventsQuery } from '../../api/events';
import { seenRoles, tableNote, type SeenRole } from '../components/tableNotes';
import { useSeat } from './lobby';
import { usePrivateEvents } from './realtime';

/**
 * The signed-in seat's table report (WW-1001). The request is the same
 * event list the seat may already read. Host-only copies are dropped here,
 * so a source or another player's result never reaches the table.
 */

type Named = { readonly playerId: string; readonly displayName: string };

/**
 * Stored facts a seat can be told, pushed to its room as soon as they are
 * written. Night facts are written just after the night commits, so a poll
 * can see the new phase before they exist; these events refetch the report.
 */
export const REPORT_EVENTS: readonly string[] = [
  'INVESTIGATION_RESULT',
  'INFECTION_OCCURRED',
  'ROLE_CONVERTED',
  'ACTION_BLOCKED',
  'RESULT_PUBLISHED',
  'PLAYER_ELIMINATED',
  'GHOST_HINT',
  'PLAYER_RETURNED',
  'SILENCED',
  'REWIND_RESULT',
  'ABILITY_COPIED',
  'CHAOS_EVENT',
];

/**
 * When the socket is down, one more read this long after a phase change
 * catches facts written after the commit the poll saw.
 */
export const LATE_EVENTS_MS = 1500;

function useReportEvents(phase: GamePhase | undefined, stateVersion: number | undefined, youId: string | undefined) {
  const seat = useSeat();
  const enabled = Boolean(seat && youId && phase && phase !== 'LOBBY');
  const query = useGetEventsQuery(enabled && seat ? { gameId: seat.gameId, afterSeq: 0 } : skipToken);
  const { refetch } = query;
  const seen = useRef(stateVersion);
  useEffect(() => {
    if (!enabled || stateVersion === undefined || seen.current === stateVersion) return undefined;
    seen.current = stateVersion;
    void refetch();
    const late = setTimeout(() => void refetch(), LATE_EVENTS_MS);
    return () => clearTimeout(late);
  }, [enabled, stateVersion, refetch]);
  const onEvent = useCallback(() => void refetch(), [refetch]);
  usePrivateEvents(REPORT_EVENTS, enabled ? onEvent : null);
  return { enabled, events: query.data?.events ?? [] };
}

function namer(players: readonly Named[] | undefined) {
  return (playerId: string) => players?.find((player) => player.playerId === playerId)?.displayName ?? 'A player';
}

export interface TableReport {
  /** Sentences for the seat's report, without duplicates. */
  readonly notes: readonly string[];
  /** Role cards this seat saw with the Seeker's once-per-game ability. */
  readonly seenRoles: readonly SeenRole[];
}

const EMPTY: TableReport = { notes: [], seenRoles: [] };

export function useTableNotes(
  phase: GamePhase | undefined,
  stateVersion: number | undefined,
  youId: string | undefined,
  players: readonly Named[] | undefined,
): TableReport {
  const { enabled, events } = useReportEvents(phase, stateVersion, youId);
  if (!enabled || !youId) return EMPTY;
  const nameOf = namer(players);
  const lines = events.map((event) => tableNote(event, youId, nameOf)).filter((line): line is string => line !== null);
  return { notes: [...new Set(lines)], seenRoles: seenRoles(events, youId, nameOf) };
}

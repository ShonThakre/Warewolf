import { skipToken } from '@reduxjs/toolkit/query/react';
import type { GameEvent } from '@warewolf/contracts';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetEventsQuery } from '../../api/events';
import { useSeat } from './lobby';

/**
 * The host's event log (WW-1202). A guest never sends the request.
 * Payloads stay off the screen: a type becomes a sentence in the dashboard.
 */

const EVENT_WORD: Record<string, string> = {
  PHASE_CHANGED: 'The phase changed.',
  NIGHT_PUBLISHED: 'The night was published.',
  PLAYER_ELIMINATED: 'A player was eliminated.',
};

export function eventSentence(event: GameEvent): string {
  return EVENT_WORD[event.type] ?? 'A private record.';
}

export interface HostEventsState {
  readonly events: readonly GameEvent[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
}

/** Pass true only for the host after the deal. */
export function useHostEvents(enabled: boolean): HostEventsState {
  const seat = useSeat();
  const open = Boolean(enabled && seat?.isHost);
  const query = useGetEventsQuery(open && seat ? { gameId: seat.gameId, afterSeq: 0 } : skipToken);
  return {
    events: open ? (query.data?.events ?? []) : [],
    isLoading: open && query.isLoading,
    error: open ? apiErrorOf(query.error) : null,
  };
}

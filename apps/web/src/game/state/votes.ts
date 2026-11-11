import type { CastVoteResponse } from '@warewolf/contracts';
import { useCallback } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useCastVoteMutation } from '../../api/votes';
import { useSeat } from './lobby';

export interface CastVoteControl {
  /** Resolves to the stored ballot, or null when refused. Read `error` for why. */
  readonly cast: (targetPlayerId: string | null) => Promise<CastVoteResponse | null>;
  readonly isCasting: boolean;
  readonly error: ApiErrorInfo | null;
}

/** Sends the caller's own ballot. A later cast on the same ballot replaces it. */
export function useCastVote(): CastVoteControl {
  const seat = useSeat();
  const [trigger, result] = useCastVoteMutation();

  const cast = useCallback(
    async (targetPlayerId: string | null) => {
      if (!seat) return null;
      const outcome = await trigger({ gameId: seat.gameId, targetPlayerId });
      return 'data' in outcome && outcome.data ? outcome.data : null;
    },
    [seat, trigger],
  );

  return { cast, isCasting: result.isLoading, error: apiErrorOf(result.error) };
}

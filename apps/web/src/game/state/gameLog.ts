import { skipToken } from '@reduxjs/toolkit/query/react';
import type { GameLog, LogEntry } from '@warewolf/contracts';
import { useCallback, useMemo, useState } from 'react';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useGetGameLogQuery, useGetHostLogQuery } from '../../api/log';

/**
 * LOG-02: the game log for a screen, plus the unread count for the rail's Log
 * tab. "Seen" is the newest stored event seq the player has looked at, kept
 * per game in localStorage so it survives a reload. A convenience: if storage
 * is blocked, everything new simply counts as unread for this visit.
 */

const SEEN_PREFIX = 'warewolf.log-seen.';

function readSeen(gameId: string): number {
  try {
    const raw = globalThis.localStorage?.getItem(SEEN_PREFIX + gameId);
    const n = raw ? Number(raw) : 0;
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeSeen(gameId: string, seq: number): void {
  try {
    globalThis.localStorage?.setItem(SEEN_PREFIX + gameId, String(seq));
  } catch {
    // Unread counts reset on reload.
  }
}

/** Every entry, newest round first. */
export function allEntries(log: GameLog): LogEntry[] {
  return [...log.lobby, ...log.rounds.flatMap((r) => [...r.night, ...r.day]), ...log.end];
}

export interface GameLogView {
  readonly log: GameLog | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
  /** Stored entries newer than the last time the log was seen. */
  readonly unread: number;
  readonly markSeen: () => void;
}

export function useGameLog(gameId: string | null | undefined, options: { readonly host?: boolean } = {}): GameLogView {
  const player = useGetGameLogQuery(gameId && !options.host ? gameId : skipToken, { refetchOnMountOrArgChange: true });
  const host = useGetHostLogQuery(gameId && options.host ? gameId : skipToken, { refetchOnMountOrArgChange: true });
  const query = options.host ? host : player;
  const [seen, setSeen] = useState(() => (gameId ? readSeen(gameId) : 0));
  const log = query.data ?? null;

  const unread = useMemo(() => (log ? allEntries(log).filter((e) => e.seq !== null && e.seq > seen && e.kind !== 'PHASE_CHANGED').length : 0), [log, seen]);

  const markSeen = useCallback(() => {
    if (!gameId || !log || log.lastSeq <= seen) return;
    writeSeen(gameId, log.lastSeq);
    setSeen(log.lastSeq);
  }, [gameId, log, seen]);

  return {
    log,
    isLoading: query.isLoading,
    error: query.error ? apiErrorOf(query.error) : null,
    refetch: () => void query.refetch(),
    unread,
    markSeen,
  };
}

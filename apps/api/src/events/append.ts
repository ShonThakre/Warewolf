import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Transaction } from '../db/database.js';
import { gameEvents, type GamePlayerRow } from '../db/schema.js';
import type { StoredEvent } from './event.service.js';
import type { EventAudience } from './night-events.js';

/** One row to append. Without a `dedupeKey` the row is always written. */
export interface EventDraft {
  readonly type: string;
  readonly audience: EventAudience;
  readonly recipientPlayerId?: string | null;
  readonly payload: Record<string, unknown>;
  readonly dedupeKey?: string;
}

/**
 * LOG-01: a seat as the log names it, copied into the payload when the event
 * is written. Lobby seats are deleted on leave and kick, so a later read could
 * not resolve the id. Public facts only: no role, no token, no device key.
 */
export interface PlayerSnapshot {
  readonly playerId: string;
  readonly displayName: string;
  readonly seatNumber: number;
  readonly avatarId: number;
}

export function snapshot(seat: Pick<GamePlayerRow, 'id' | 'displayName' | 'seatNumber' | 'avatarId'>): PlayerSnapshot {
  return { playerId: seat.id, displayName: seat.displayName, seatNumber: seat.seatNumber, avatarId: seat.avatarId };
}

/**
 * Appends rows after the game's current last `seq`. The caller must hold the
 * game row lock (`select ... for update`), which every writer of
 * `game_events` takes, so two appends cannot pick the same `seq`. A row whose
 * dedupe key already exists is skipped. Returns the rows written, to emit
 * after commit.
 */
export async function appendEvents(tx: Transaction, gameId: string, drafts: readonly EventDraft[]): Promise<StoredEvent[]> {
  if (drafts.length === 0) return [];
  const [maxRow] = await tx
    .select({ max: sql<number>`coalesce(max(${gameEvents.seq}), 0)::int` })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId));
  let seq = Number(maxRow?.max ?? 0);
  const stored: StoredEvent[] = [];
  for (const draft of drafts) {
    const recipientPlayerId = draft.recipientPlayerId ?? null;
    const inserted = await tx
      .insert(gameEvents)
      .values({
        gameId,
        seq: seq + 1,
        type: draft.type,
        audience: draft.audience,
        recipientPlayerId,
        payload: draft.payload,
        dedupeKey: draft.dedupeKey ?? `once:${randomUUID()}`,
      })
      .onConflictDoNothing({ target: [gameEvents.gameId, gameEvents.dedupeKey] })
      .returning({ seq: gameEvents.seq });
    const row = inserted[0];
    if (!row) continue;
    seq = row.seq;
    stored.push({ gameId, seq: row.seq, type: draft.type, audience: draft.audience, recipientPlayerId, payload: draft.payload });
  }
  return stored;
}

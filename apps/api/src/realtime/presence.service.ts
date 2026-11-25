import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers, games } from '../db/schema.js';
import { appendEvents, snapshot } from '../events/append.js';
import type { StoredEvent } from '../events/event.service.js';

/** How long a seat may have no socket before it counts as away. Covers a reload, a tunnel, a phone switching networks. */
export const PRESENCE_GRACE_MS = 20_000;

/**
 * ID-02: who is here. Counts the live `/play` sockets of each seat, in memory.
 *
 * - First socket: the seat is `CONNECTED`. If the log announced it away,
 *   `PLAYER_RECONNECTED` is written.
 * - Last socket gone: a grace timer starts. A socket inside the grace changes
 *   nothing, so a reload or a flaky phone makes no noise. When it runs out the
 *   seat is `DISCONNECTED` and `PLAYER_DISCONNECTED` is written.
 *
 * In memory is right for one API process (the Render deployment). Several
 * processes would need a shared adapter and a shared count; the column would
 * still be the source clients read.
 */
@Injectable()
export class PresenceService implements OnApplicationShutdown {
  private readonly logger = new Logger('Presence');
  private readonly sockets = new Map<string, number>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** Seats the log has announced as away, so a return is announced too. */
  private readonly away = new Set<string>();
  private emit: (events: readonly StoredEvent[]) => void = () => {};
  /** Tests shorten it. */
  graceMs = PRESENCE_GRACE_MS;

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** The gateway passes its emitter, so presence rows reach the rooms after commit. */
  bind(emit: (events: readonly StoredEvent[]) => void): void {
    this.emit = emit;
  }

  /** Boot: nobody has a socket to a fresh process. */
  async resetAll(): Promise<void> {
    await this.db.update(gamePlayers).set({ connectionStatus: 'DISCONNECTED' }).where(eq(gamePlayers.connectionStatus, 'CONNECTED'));
  }

  async connected(gameId: string, playerId: string): Promise<void> {
    const count = (this.sockets.get(playerId) ?? 0) + 1;
    this.sockets.set(playerId, count);
    const pending = this.timers.get(playerId);
    if (pending) {
      clearTimeout(pending);
      this.timers.delete(playerId);
    }
    if (count !== 1) return;
    const announce = this.away.delete(playerId);
    await this.write(gameId, playerId, 'CONNECTED', announce ? 'PLAYER_RECONNECTED' : null);
  }

  disconnected(gameId: string, playerId: string): void {
    const count = Math.max(0, (this.sockets.get(playerId) ?? 0) - 1);
    if (count > 0) {
      this.sockets.set(playerId, count);
      return;
    }
    this.sockets.delete(playerId);
    if (this.timers.has(playerId)) return;
    const timer = setTimeout(() => {
      this.timers.delete(playerId);
      if ((this.sockets.get(playerId) ?? 0) > 0) return;
      this.away.add(playerId);
      void this.write(gameId, playerId, 'DISCONNECTED', 'PLAYER_DISCONNECTED').catch((error: unknown) => {
        this.logger.warn(`presence write failed game=${gameId} player=${playerId}: ${String(error)}`);
      });
    }, this.graceMs);
    timer.unref?.();
    this.timers.set(playerId, timer);
  }

  /** Live socket count for a seat. Tests read it. */
  socketCount(playerId: string): number {
    return this.sockets.get(playerId) ?? 0;
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /**
   * Sets the column and, for an open game, appends the log row, under the
   * game lock like every other `game_events` writer. A seat that is gone
   * (kicked, left) writes nothing.
   */
  private async write(gameId: string, playerId: string, status: 'CONNECTED' | 'DISCONNECTED', type: 'PLAYER_RECONNECTED' | 'PLAYER_DISCONNECTED' | null): Promise<void> {
    const events = await this.db.transaction(async (tx) => {
      const [game] = await tx
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.id, gameId), inArray(games.status, ['LOBBY', 'ACTIVE'])))
        .for('update');
      const [seat] = await tx
        .update(gamePlayers)
        .set({ connectionStatus: status })
        .where(and(eq(gamePlayers.id, playerId), eq(gamePlayers.gameId, gameId)))
        .returning();
      if (!game || !seat || !type) return [];
      return appendEvents(tx, gameId, [{ type, audience: 'PUBLIC', payload: { player: snapshot(seat) } }]);
    });
    this.emit(events);
  }
}

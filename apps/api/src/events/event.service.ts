import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE, type Database, type Transaction } from '../db/database.js';
import {
  abilityInstances,
  eliminationRecords,
  gameEvents,
  gamePlayers,
  games,
  infectionRecords,
  investigationRecords,
  resolutionRuns,
  roleConversionRecords,
} from '../db/schema.js';
import { nightEventDrafts, type NightEventSource } from './night-events.js';

interface StoredBlock {
  readonly actionId?: string;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly informTarget?: boolean;
  readonly cancelledActionIds?: readonly string[];
}

/** Writes `game_events` from the night's stored rows. A second call inserts nothing. */
@Injectable()
export class EventService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Every committed night that does not yet have its published marker. */
  async republishNights(): Promise<number> {
    const runs = await this.db
      .select({ gameId: resolutionRuns.gameId, roundNumber: resolutionRuns.roundNumber })
      .from(resolutionRuns)
      .where(eq(resolutionRuns.phaseKind, 'NIGHT'));
    for (const run of runs) await this.publishNight(run.gameId, run.roundNumber);
    return runs.length;
  }

  /**
   * After the night transaction has committed. Reads the stored records and
   * appends one row per audience. The marker row makes a retry a no-op, so a
   * crash between commit and this write is repaired on the next boot.
   */
  async publishNight(gameId: string, round: number): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [game] = await tx.select({ id: games.id }).from(games).where(eq(games.id, gameId)).for('update');
      if (!game) return 0;
      const markerKey = `night:${round}:published`;
      const [marker] = await tx
        .select({ seq: gameEvents.seq })
        .from(gameEvents)
        .where(and(eq(gameEvents.gameId, gameId), eq(gameEvents.dedupeKey, markerKey)))
        .limit(1);
      if (marker) return 0;

      const [run] = await tx
        .select({ result: resolutionRuns.result })
        .from(resolutionRuns)
        .where(and(eq(resolutionRuns.gameId, gameId), eq(resolutionRuns.roundNumber, round), eq(resolutionRuns.phaseKind, 'NIGHT')))
        .limit(1);
      if (!run) return 0;

      const source = await this.load(tx, gameId, round, run.result);
      const drafts = nightEventDrafts(source);
      const [maxRow] = await tx
        .select({ max: sql<number>`coalesce(max(${gameEvents.seq}), 0)::int` })
        .from(gameEvents)
        .where(eq(gameEvents.gameId, gameId));
      let seq = Number(maxRow?.max ?? 0);
      let written = 0;
      for (const draft of drafts) {
        seq += 1;
        const inserted = await tx
          .insert(gameEvents)
          .values({
            gameId,
            seq,
            type: draft.type,
            audience: draft.audience,
            recipientPlayerId: draft.recipientPlayerId,
            payload: draft.payload,
            dedupeKey: draft.dedupeKey,
          })
          .onConflictDoNothing({ target: [gameEvents.gameId, gameEvents.dedupeKey] })
          .returning({ seq: gameEvents.seq });
        if (inserted.length > 0) written += 1;
      }
      seq += 1;
      await tx.insert(gameEvents).values({
        gameId,
        seq,
        type: 'NIGHT_PUBLISHED',
        audience: 'HOST',
        recipientPlayerId: null,
        payload: { roundNumber: round },
        dedupeKey: markerKey,
      });
      return written;
    });
  }

  private async load(
    tx: Transaction,
    gameId: string,
    round: number,
    result: unknown,
  ): Promise<NightEventSource> {
    const seats = await tx.select({ id: gamePlayers.id, seatNumber: gamePlayers.seatNumber }).from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
    const seatNumber = new Map(seats.map((s) => [s.id, s.seatNumber]));
    const investigations = await tx
      .select()
      .from(investigationRecords)
      .where(and(eq(investigationRecords.gameId, gameId), eq(investigationRecords.roundNumber, round)));
    const infections = await tx
      .select()
      .from(infectionRecords)
      .where(and(eq(infectionRecords.gameId, gameId), eq(infectionRecords.roundNumber, round)));
    const conversions = await tx
      .select()
      .from(roleConversionRecords)
      .where(and(eq(roleConversionRecords.gameId, gameId), eq(roleConversionRecords.roundNumber, round)));
    const eliminations = await tx
      .select()
      .from(eliminationRecords)
      .where(and(eq(eliminationRecords.gameId, gameId), eq(eliminationRecords.roundNumber, round), eq(eliminationRecords.phaseKind, 'NIGHT')));
    const revoked = await tx
      .select({ playerId: abilityInstances.playerId, abilityId: abilityInstances.abilityId })
      .from(abilityInstances)
      .where(and(eq(abilityInstances.gameId, gameId), eq(abilityInstances.status, 'REVOKED')));
    const revokedByPlayer = new Map<string, string[]>();
    for (const row of revoked) {
      const list = revokedByPlayer.get(row.playerId) ?? [];
      list.push(row.abilityId);
      revokedByPlayer.set(row.playerId, list);
    }
    const roleAfter = new Map(conversions.map((c) => [c.playerId, c.toRoleId]));
    const blocks = blocksOf(result);

    return {
      round,
      investigations: investigations.map((row) => ({
        actionId: row.actionId,
        actorPlayerId: row.actorPlayerId,
        abilityId: row.abilityId,
        kind: row.kind,
        targetPlayerIds: row.targetPlayerIds,
        result: row.result,
      })),
      infections: infections.flatMap((row) =>
        row.actionId
          ? [
              {
                actionId: row.actionId,
                sourcePlayerId: row.sourcePlayerId,
                targetPlayerId: row.targetPlayerId,
                outcome: row.outcome,
                roleId: roleAfter.get(row.targetPlayerId) ?? null,
              },
            ]
          : [],
      ),
      conversions: conversions.map((row) => ({
        playerId: row.playerId,
        toRoleId: row.toRoleId,
        reason: row.reason,
        revokedAbilityIds: revokedByPlayer.get(row.playerId) ?? [],
      })),
      eliminations: eliminations.map((row) => ({
        playerId: row.playerId,
        seatNumber: seatNumber.get(row.playerId) ?? 0,
        roleAtDeath: row.roleAtDeath,
        revealedPublicly: row.revealedPublicly,
      })),
      blocks,
    };
  }
}

function blocksOf(result: unknown): NightEventSource['blocks'] {
  const blocks = (result as { blocks?: readonly StoredBlock[] } | null)?.blocks;
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap((block) => {
    if (!block.actionId || !block.actorId || !block.targetId) return [];
    return [
      {
        actionId: block.actionId,
        actorId: block.actorId,
        targetId: block.targetId,
        informTarget: block.informTarget === true,
        cancelledActionIds: [...(block.cancelledActionIds ?? [])],
      },
    ];
  });
}

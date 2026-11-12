import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, or, sql } from 'drizzle-orm';
import { gameEventsResponseSchema, type GameEventsResponse } from '@warewolf/contracts';
import { DATABASE, type Database, type Transaction } from '../db/database.js';
import {
  abilityInstances,
  dayTallies,
  eliminationRecords,
  gameEvents,
  gamePlayers,
  games,
  infectionRecords,
  investigationRecords,
  resolutionRuns,
  roleAssignments,
  roleConversionRecords,
  scheduledEffects,
} from '../db/schema.js';
import { toDayTally } from '../day/tallies.js';
import { isVampireTeamRole } from '@warewolf/domain';
import { nightEventDrafts, type EventAudience, type NightEventSource } from './night-events.js';

/** One stored row, ready to emit. The payload is already the audience's copy. */
export interface StoredEvent {
  readonly gameId: string;
  readonly seq: number;
  readonly type: string;
  readonly audience: EventAudience;
  readonly recipientPlayerId: string | null;
  readonly payload: Record<string, unknown>;
}

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

  /** Every committed night that does not yet have its published marker. Returns only the rows this call inserted. */
  async republishNights(): Promise<StoredEvent[]> {
    const runs = await this.db
      .select({ gameId: resolutionRuns.gameId, roundNumber: resolutionRuns.roundNumber })
      .from(resolutionRuns)
      .where(eq(resolutionRuns.phaseKind, 'NIGHT'));
    const fresh: StoredEvent[] = [];
    for (const run of runs) fresh.push(...(await this.publishNight(run.gameId, run.roundNumber)));
    return fresh;
  }

  /**
   * The public tally of each closed ballot (WW-904, OD-85), as one PUBLIC
   * `VOTE_TALLY` row per ballot. Written after the day close commits, from
   * the stored `day_tallies` row. The dedupe key makes a retry, or the boot
   * repair below, insert nothing twice. Pass a round to publish only it.
   */
  async publishTallies(gameId: string, round?: number): Promise<StoredEvent[]> {
    return this.db.transaction(async (tx) => {
      const [game] = await tx.select({ id: games.id }).from(games).where(eq(games.id, gameId)).for('update');
      if (!game) return [];
      const rows = await tx
        .select()
        .from(dayTallies)
        .where(round === undefined ? eq(dayTallies.gameId, gameId) : and(eq(dayTallies.gameId, gameId), eq(dayTallies.roundNumber, round)))
        .orderBy(dayTallies.roundNumber, dayTallies.ballot);
      const [maxRow] = await tx
        .select({ max: sql<number>`coalesce(max(${gameEvents.seq}), 0)::int` })
        .from(gameEvents)
        .where(eq(gameEvents.gameId, gameId));
      let seq = Number(maxRow?.max ?? 0);
      const stored: StoredEvent[] = [];
      for (const row of rows) {
        const payload = toDayTally(row) as unknown as Record<string, unknown>;
        const inserted = await tx
          .insert(gameEvents)
          .values({
            gameId,
            seq: seq + 1,
            type: 'VOTE_TALLY',
            audience: 'PUBLIC',
            recipientPlayerId: null,
            payload,
            dedupeKey: `tally:${row.roundNumber}:${row.ballot}`,
          })
          .onConflictDoNothing({ target: [gameEvents.gameId, gameEvents.dedupeKey] })
          .returning({ seq: gameEvents.seq });
        const done = inserted[0];
        if (!done) continue;
        seq = done.seq;
        stored.push({ gameId, seq: done.seq, type: 'VOTE_TALLY', audience: 'PUBLIC', recipientPlayerId: null, payload });
      }
      return stored;
    });
  }

  /** Boot repair: every game with a tally row that has no event yet. */
  async republishTallies(): Promise<StoredEvent[]> {
    const games_ = await this.db.selectDistinct({ gameId: dayTallies.gameId }).from(dayTallies);
    const fresh: StoredEvent[] = [];
    for (const { gameId } of games_) fresh.push(...(await this.publishTallies(gameId)));
    return fresh;
  }

  /**
   * Events this seat may see with `seq` greater than `afterSeq`. Public rows,
   * the seat's own player rows, and host rows when the seat is the host.
   */
  async since(gameId: string, seat: { readonly id: string; readonly isHost: boolean }, afterSeq: number): Promise<GameEventsResponse> {
    const own = and(eq(gameEvents.audience, 'PLAYER'), eq(gameEvents.recipientPlayerId, seat.id));
    const visible = seat.isHost ? or(eq(gameEvents.audience, 'PUBLIC'), eq(gameEvents.audience, 'HOST'), own) : or(eq(gameEvents.audience, 'PUBLIC'), own);
    const rows = await this.db
      .select({
        seq: gameEvents.seq,
        type: gameEvents.type,
        audience: gameEvents.audience,
        payload: gameEvents.payload,
      })
      .from(gameEvents)
      .where(and(eq(gameEvents.gameId, gameId), gt(gameEvents.seq, afterSeq), visible))
      .orderBy(asc(gameEvents.seq));
    return gameEventsResponseSchema.parse({ events: rows });
  }

  /**
   * A public phase signal (WW-1103). Written after the close has committed,
   * so a rollback cannot announce a phase that did not happen. The same
   * state version inserts nothing. The payload names the phase and the
   * round, never a role.
   */
  async publishPhase(gameId: string, phase: string, roundNumber: number, stateVersion: number): Promise<StoredEvent[]> {
    return this.db.transaction(async (tx) => {
      const [game] = await tx.select({ id: games.id }).from(games).where(eq(games.id, gameId)).for('update');
      if (!game) return [];
      const dedupeKey = `phase:${stateVersion}`;
      const [existing] = await tx
        .select({ seq: gameEvents.seq })
        .from(gameEvents)
        .where(and(eq(gameEvents.gameId, gameId), eq(gameEvents.dedupeKey, dedupeKey)))
        .limit(1);
      if (existing) return [];
      const [maxRow] = await tx
        .select({ max: sql<number>`coalesce(max(${gameEvents.seq}), 0)::int` })
        .from(gameEvents)
        .where(eq(gameEvents.gameId, gameId));
      const seq = Number(maxRow?.max ?? 0) + 1;
      const payload = { phase, roundNumber, stateVersion };
      await tx.insert(gameEvents).values({
        gameId,
        seq,
        type: 'PHASE_CHANGED',
        audience: 'PUBLIC',
        recipientPlayerId: null,
        payload,
        dedupeKey,
      });
      return [{ gameId, seq, type: 'PHASE_CHANGED', audience: 'PUBLIC', recipientPlayerId: null, payload }];
    });
  }

  /**
   * After the night transaction has committed. Reads the stored records and
   * appends one row per audience. The marker row makes a retry a no-op, so a
   * crash between commit and this write is repaired on the next boot.
   */
  async publishNight(gameId: string, round: number): Promise<StoredEvent[]> {
    return this.db.transaction(async (tx) => {
      const [game] = await tx.select({ id: games.id }).from(games).where(eq(games.id, gameId)).for('update');
      if (!game) return [];
      const markerKey = `night:${round}:published`;
      const [marker] = await tx
        .select({ seq: gameEvents.seq })
        .from(gameEvents)
        .where(and(eq(gameEvents.gameId, gameId), eq(gameEvents.dedupeKey, markerKey)))
        .limit(1);
      if (marker) return [];

      const [run] = await tx
        .select({ result: resolutionRuns.result })
        .from(resolutionRuns)
        .where(and(eq(resolutionRuns.gameId, gameId), eq(resolutionRuns.roundNumber, round), eq(resolutionRuns.phaseKind, 'NIGHT')))
        .limit(1);
      if (!run) return [];

      const source = await this.load(tx, gameId, round, run.result);
      const drafts = nightEventDrafts(source);
      const [maxRow] = await tx
        .select({ max: sql<number>`coalesce(max(${gameEvents.seq}), 0)::int` })
        .from(gameEvents)
        .where(eq(gameEvents.gameId, gameId));
      let seq = Number(maxRow?.max ?? 0);
      const stored: StoredEvent[] = [];
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
        const row = inserted[0];
        if (row) stored.push({ gameId, seq: row.seq, type: draft.type, audience: draft.audience, recipientPlayerId: draft.recipientPlayerId, payload: draft.payload });
      }
      seq += 1;
      const [published] = await tx
        .insert(gameEvents)
        .values({
          gameId,
          seq,
          type: 'NIGHT_PUBLISHED',
          audience: 'HOST',
          recipientPlayerId: null,
          payload: { roundNumber: round },
          dedupeKey: markerKey,
        })
        .returning({ seq: gameEvents.seq });
      if (published) stored.push({ gameId, seq: published.seq, type: 'NIGHT_PUBLISHED', audience: 'HOST', recipientPlayerId: null, payload: { roundNumber: round } });
      return stored;
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
    const marks = await tx
      .select({ targetPlayerId: scheduledEffects.targetPlayerId, sourcePlayerId: scheduledEffects.sourcePlayerId })
      .from(scheduledEffects)
      .where(
        and(
          eq(scheduledEffects.gameId, gameId),
          eq(scheduledEffects.kind, 'VAMPIRE_MARK'),
          eq(scheduledEffects.status, 'SPENT'),
          eq(scheduledEffects.closedRound, round),
        ),
      );
    const markSource = new Map(marks.map((mark) => [mark.targetPlayerId, mark.sourcePlayerId]));
    const roster = await tx
      .select({ playerId: roleAssignments.playerId, roleId: roleAssignments.currentRoleId, lifeStatus: gamePlayers.lifeStatus })
      .from(roleAssignments)
      .innerJoin(gamePlayers, eq(gamePlayers.id, roleAssignments.playerId))
      .where(eq(roleAssignments.gameId, gameId));
    const teamPlayerIds = roster.filter((seat) => seat.lifeStatus === 'ALIVE' && isVampireTeamRole(seat.roleId)).map((seat) => seat.playerId);
    const vampirePlayerId = roster.find((seat) => seat.lifeStatus === 'ALIVE' && seat.roleId === 'vampire')?.playerId ?? null;

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
        ...(row.reason === 'VAMPIRE'
          ? { vampirePlayerId: vampirePlayerId ?? markSource.get(row.playerId) ?? null, teamPlayerIds }
          : {}),
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

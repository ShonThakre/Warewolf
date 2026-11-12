import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database, Transaction } from '../db/database.js';
import { abilityInstances, investigationRecords, nightActions, type GameRow, type InvestigationRecordRow } from '../db/schema.js';

/**
 * GAP-01: a Seeker publishes a stored result (game-rules.md, "Day").
 *
 * The Seeker submits `ROLE_REVEAL` during day discussion with no target.
 * When discussion closes, each locked reveal publishes that Seeker's latest
 * result that is not public yet. The record stays private in the table; the
 * public copy is a `RESULT_PUBLISHED` event written after commit
 * (EventService.publishResults). A reveal with nothing left to publish is
 * rejected, though the submission check normally refuses it first.
 */

type Reader = Pick<Database, 'select'> | Pick<Transaction, 'select'>;

/** The holder's newest result that has not been published. */
export async function latestUnpublished(db: Reader, gameId: string, playerId: string): Promise<InvestigationRecordRow | undefined> {
  const [row] = await db
    .select()
    .from(investigationRecords)
    .where(and(eq(investigationRecords.gameId, gameId), eq(investigationRecords.actorPlayerId, playerId), eq(investigationRecords.published, false)))
    .orderBy(desc(investigationRecords.roundNumber), desc(investigationRecords.createdAt))
    .limit(1);
  return row;
}

/** Runs inside the close of DAY_DISCUSSION, after its actions are locked. Returns how many results became public. */
export async function publishLockedReveals(tx: Transaction, game: GameRow): Promise<number> {
  const locked = await tx
    .select({ action: nightActions, ability: abilityInstances })
    .from(nightActions)
    .innerJoin(abilityInstances, eq(abilityInstances.id, nightActions.abilityInstanceId))
    .where(
      and(
        eq(nightActions.gameId, game.id),
        eq(nightActions.roundNumber, game.roundNumber),
        eq(nightActions.phase, 'DAY_DISCUSSION'),
        eq(nightActions.status, 'LOCKED'),
      ),
    )
    .orderBy(asc(nightActions.createdAt));

  let published = 0;
  for (const { action, ability } of locked) {
    if (ability.config.capability !== 'ROLE_REVEAL') continue;
    const record = await latestUnpublished(tx, game.id, action.playerId);
    if (!record) {
      await tx.update(nightActions).set({ status: 'REJECTED', rejectedReason: 'TARGET_ILLEGAL' }).where(eq(nightActions.id, action.id));
      continue;
    }
    await tx.update(investigationRecords).set({ published: true, publishedRound: game.roundNumber }).where(eq(investigationRecords.id, record.id));
    await tx.update(nightActions).set({ status: 'RESOLVED' }).where(eq(nightActions.id, action.id));
    const charges = ability.chargesRemaining === null ? null : Math.max(0, ability.chargesRemaining - 1);
    await tx
      .update(abilityInstances)
      .set({ chargesRemaining: charges, usesConsumed: ability.usesConsumed + 1, ...(charges === 0 ? { status: 'EXHAUSTED' as const } : {}) })
      .where(eq(abilityInstances.id, ability.id));
    published++;
  }
  return published;
}

/** The public copy of a published result. Names the publisher, who chose to speak; never the ability, which would name more than they said. */
export function publishedResultPayload(row: InvestigationRecordRow): Record<string, unknown> {
  return {
    roundNumber: row.publishedRound,
    investigatedRound: row.roundNumber,
    publisherPlayerId: row.actorPlayerId,
    kind: row.kind,
    targetPlayerIds: [...row.targetPlayerIds],
    result: row.result,
  };
}

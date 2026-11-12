import { parseGameConfiguration } from '@warewolf/contracts';
import type { ActionWindow, HostKillDecision, NightInput } from '@warewolf/domain';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database, Transaction } from '../db/database.js';
import {
  abilityInstances,
  gamePlayers,
  nightActions,
  nightKillDecisions,
  roleAssignments,
  scheduledEffects,
  type GameRow,
  type NightKillDecisionRow,
} from '../db/schema.js';

type Executor = Database | Transaction;

/** The night's two submission windows. Day abilities resolve with the day. */
const NIGHT_WINDOWS: readonly ActionWindow[] = ['NIGHT_SUBMIT', 'NIGHT_REACTION'];

export function decisionOf(row: NightKillDecisionRow): HostKillDecision {
  return row.noKill || !row.targetPlayerId ? { kind: 'NO_KILL' } : { kind: 'TARGET', playerId: row.targetPlayerId };
}

/** The host's confirmed target for a round, or null before the host chose (WW-803). */
export async function hostDecisionFor(db: Executor, gameId: string, round: number): Promise<HostKillDecision | null> {
  const [row] = await db
    .select()
    .from(nightKillDecisions)
    .where(and(eq(nightKillDecisions.gameId, gameId), eq(nightKillDecisions.roundNumber, round)));
  return row ? decisionOf(row) : null;
}

/**
 * The start-of-night state the pure resolver reads: seats, assignments,
 * abilities, this round's LOCKED night actions, open effects, the infection
 * counter, and the host's decision. Sorted by id so the input hash does not
 * depend on row order. Every reader of the night uses this one loader, so the
 * host's candidates, the Doctor's target, and the resolution agree.
 */
export async function loadNightInput(db: Executor, game: GameRow): Promise<NightInput> {
  const [players, assignments, abilities, actions, effects, hostDecision] = await Promise.all([
    db.select().from(gamePlayers).where(eq(gamePlayers.gameId, game.id)).orderBy(asc(gamePlayers.id)),
    db.select().from(roleAssignments).where(eq(roleAssignments.gameId, game.id)).orderBy(asc(roleAssignments.playerId)),
    db.select().from(abilityInstances).where(eq(abilityInstances.gameId, game.id)).orderBy(asc(abilityInstances.id)),
    db
      .select()
      .from(nightActions)
      .where(
        and(
          eq(nightActions.gameId, game.id),
          eq(nightActions.roundNumber, game.roundNumber),
          eq(nightActions.status, 'LOCKED'),
          inArray(nightActions.phase, [...NIGHT_WINDOWS]),
        ),
      )
      .orderBy(asc(nightActions.id)),
    db
      .select()
      .from(scheduledEffects)
      .where(and(eq(scheduledEffects.gameId, game.id), eq(scheduledEffects.status, 'ACTIVE')))
      .orderBy(asc(scheduledEffects.id)),
    hostDecisionFor(db, game.id, game.roundNumber),
  ]);

  return {
    round: game.roundNumber,
    config: parseGameConfiguration(game.configSnapshot),
    players: players.map((p) => ({ id: p.id, lifeStatus: p.lifeStatus })),
    assignments: assignments.map((a) => ({
      playerId: a.playerId,
      currentRoleId: a.currentRoleId,
      currentProfileId: a.currentProfileId,
      currentFaction: a.currentFaction,
      wolfAligned: a.wolfAligned,
      individualVictory: a.individualVictory,
    })),
    abilities: abilities.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      status: a.status,
      chargesRemaining: a.chargesRemaining,
      usesConsumed: a.usesConsumed,
      lastUsedRound: a.lastUsedRound,
      lastTargetPlayerId: a.lastTargetPlayerId,
      availableFromRound: a.availableFromRound,
      expiresRound: a.expiresRound,
      source: a.source,
      config: a.config,
    })),
    actions: actions.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      abilityInstanceId: a.abilityInstanceId,
      phase: a.phase,
      targetPlayerIds: a.targetPlayerIds,
      payload: a.payload,
    })),
    hostDecision,
    infection: { successes: game.infectionSuccesses, sealed: game.infectionSealed },
    effects: effects.map((e) => ({
      id: e.id,
      kind: e.kind,
      sourcePlayerId: e.sourcePlayerId,
      sourceAbilityInstanceId: e.sourceAbilityInstanceId,
      targetPlayerId: e.targetPlayerId,
      createdRound: e.createdRound,
      dueRound: e.dueRound,
      duePhase: e.duePhase,
      attackTypes: e.attackTypes,
      ...(e.chaosKind ? { chaosKind: e.chaosKind } : {}),
      playerIds: e.playerIds ?? [],
    })),
  };
}

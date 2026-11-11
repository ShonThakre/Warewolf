import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  canonicalJson,
  resolveNight,
  type AbilityUpdate,
  type InvestigationResult,
  type NightInput,
  type NightResolution,
  type NightResult,
} from '@warewolf/domain';
import { and, eq } from 'drizzle-orm';
import { changeAssignment } from '../assignment/assignment.repository.js';
import type { Transaction } from '../db/database.js';
import {
  abilityInstances,
  eliminationRecords,
  gamePlayers,
  games,
  infectionRecords,
  investigationRecords,
  nightActions,
  resolutionRuns,
  roleAssignments,
  roleConversionRecords,
  scheduledEffects,
  type AbilityInstanceRow,
  type GameRow,
  type NewAbilityInstanceRow,
} from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { loadNightInput } from './night-input.js';
import { applyVictory } from '../victory/apply-victory.js';


/** SHA-256 of the canonical input, so a retried resolution is observable (night-resolution.md, section 9). */
export function inputHash(input: NightInput, catalogHash: string | null): string {
  const { catalog: _catalog, ...data } = input;
  return createHash('sha256').update(canonicalJson({ catalogHash, input: data }), 'utf8').digest('hex');
}

/** An investigation's private fact, without the fields the record already has as columns. */
function investigationFact(result: InvestigationResult): Record<string, unknown> {
  const { actionId: _a, actorId: _b, abilityInstanceId: _c, abilityId: _d, targetPlayerIds: _e, kind: _f, ...fact } = result;
  return fact;
}

/**
 * WW-802: night resolution inside the phase close (night-resolution.md,
 * section 9). `PhaseService` calls `resolve` in its close transaction with
 * the game row already locked, after closing the last window locked its
 * actions. This loads the start-of-night state and the LOCKED actions, runs
 * the pure `resolveNight`, and writes every row the result names. Nothing is
 * emitted here; events after commit are WW-804.
 *
 * One commit per night: the `resolution_runs` row is unique per game, round,
 * and kind. A second resolve of the same night is refused before it writes,
 * and the unique key stops one that slips past the check. Either way the
 * whole close rolls back and the phase does not move.
 */
@Injectable()
export class NightResolutionService {
  private readonly logger = new Logger('Night');

  async resolve(tx: Transaction, game: GameRow): Promise<NightResolution> {
    const round = game.roundNumber;
    const [already] = await tx
      .select({ id: resolutionRuns.id })
      .from(resolutionRuns)
      .where(and(eq(resolutionRuns.gameId, game.id), eq(resolutionRuns.roundNumber, round), eq(resolutionRuns.phaseKind, 'NIGHT')));
    if (already) throw errors.phaseConflict();

    const input = await loadNightInput(tx, game);
    const result = resolveNight(input);
    const hash = inputHash(input, game.catalogHash);
    // First write, so a duplicate fails before anything else is touched.
    await tx.insert(resolutionRuns).values({ gameId: game.id, roundNumber: round, phaseKind: 'NIGHT', inputHash: hash, result });
    await this.write(tx, game, input, result);

    this.logger.log(
      `night game=${game.id} round=${round} deaths=${result.deaths.length} conversions=${result.conversions.length} actions=${result.actions.length} hash=${hash.slice(0, 12)}`,
    );
    // Victory is WW-902. A night that ends the game does not open the day (OD-68).
    const gameOver = await applyVictory(tx, game, []);
    return { gameOver };
  }

  /** Every row the result names, in the order of night-resolution.md, section 9, steps 5 and 6. */
  private async write(tx: Transaction, game: GameRow, input: NightInput, result: NightResult): Promise<void> {
    const round = game.roundNumber;
    const config = input.config;
    const assignments = await tx.select().from(roleAssignments).where(eq(roleAssignments.gameId, game.id));
    const assignmentOf = new Map(assignments.map((a) => [a.playerId, a]));

    // Deaths: the seat, then the elimination record with every contributor.
    for (const death of result.deaths) {
      const assignment = assignmentOf.get(death.playerId)!;
      await tx.update(gamePlayers).set({ lifeStatus: 'DEAD', diedRound: round }).where(eq(gamePlayers.id, death.playerId));
      await tx.insert(eliminationRecords).values({
        gameId: game.id,
        roundNumber: round,
        phaseKind: 'NIGHT',
        playerId: death.playerId,
        roleAtDeath: death.roleIdAtDeath,
        originalRoleId: assignment.originalRoleId,
        factionAtDeath: assignment.currentFaction,
        causes: [...death.attackers],
        revealedPublicly: config.voting.revealOnNightDeath === 'CURRENT_ROLE',
      });
    }

    if (result.infection) {
      const { infection } = result;
      await tx.insert(infectionRecords).values({
        gameId: game.id,
        roundNumber: round,
        actionId: infection.actionId,
        sourcePlayerId: infection.actorId,
        targetPlayerId: infection.targetId,
        previousRoleId: assignmentOf.get(infection.targetId)!.currentRoleId,
        outcome: infection.outcome,
        failureReason: infection.reason,
      });
    }

    if (result.investigations.length > 0) {
      await tx.insert(investigationRecords).values(
        result.investigations.map((i) => ({
          gameId: game.id,
          roundNumber: round,
          actionId: i.actionId,
          actorPlayerId: i.actorId,
          abilityInstanceId: i.abilityInstanceId,
          abilityId: i.abilityId,
          kind: i.kind,
          targetPlayerIds: [...i.targetPlayerIds],
          result: investigationFact(i),
        })),
      );
    }

    // Conversions change only the current side of the assignment; originals never move.
    for (const c of result.conversions) {
      await changeAssignment(tx, assignmentOf.get(c.playerId)!.id, {
        currentRoleId: c.toRoleId,
        currentProfileId: c.toProfileId,
        currentFaction: c.toFaction,
        wolfAligned: c.wolfAligned,
        ...(c.individualVictory ? { individualVictory: c.individualVictory } : {}),
      });
      await tx.insert(roleConversionRecords).values({
        gameId: game.id,
        roundNumber: round,
        playerId: c.playerId,
        fromRoleId: c.fromRoleId,
        toRoleId: c.toRoleId,
        fromFaction: c.fromFaction,
        toFaction: c.toFaction,
        reason: c.cause,
      });
    }
    for (const m of result.marks) await changeAssignment(tx, assignmentOf.get(m.playerId)!.id, { markTargetPlayerId: m.targetId });

    for (const u of result.abilityUpdates) await this.patchAbility(tx, u);
    if (result.grants.length > 0) {
      const rows: NewAbilityInstanceRow[] = result.grants.map((g) => ({
        gameId: game.id,
        playerId: g.playerId,
        assignmentId: assignmentOf.get(g.playerId)!.id,
        abilityId: g.abilityId,
        capability: g.definition.capability,
        handlerKey: g.definition.handlerKey,
        status: g.chargesRemaining === 0 ? 'EXHAUSTED' : 'ACTIVE',
        chargesRemaining: g.chargesRemaining,
        availableFromRound: g.availableFromRound,
        expiresRound: g.expiresRound,
        source: g.source,
        sourcePlayerId: g.sourcePlayerId,
        config: g.definition,
      }));
      await tx.insert(abilityInstances).values(rows);
    }

    for (const outcome of result.actions) {
      await tx.update(nightActions).set({ status: outcome.status, rejectedReason: outcome.reason }).where(eq(nightActions.id, outcome.actionId));
    }

    if (result.newEffects.length > 0) {
      await tx.insert(scheduledEffects).values(result.newEffects.map((e) => ({ ...e, gameId: game.id, attackTypes: [...e.attackTypes] })));
    }
    for (const closed of result.closedEffects) {
      await tx.update(scheduledEffects).set({ status: closed.status, closedRound: round }).where(eq(scheduledEffects.id, closed.effectId));
    }

    await tx
      .update(games)
      .set({ infectionSuccesses: result.infectionState.successes, infectionSealed: result.infectionState.sealed })
      .where(eq(games.id, game.id));
  }

  private async patchAbility(tx: Transaction, update: AbilityUpdate): Promise<void> {
    const keys = ['chargesRemaining', 'usesConsumed', 'lastUsedRound', 'lastTargetPlayerId', 'status', 'revokedReason'] as const;
    const set: Partial<AbilityInstanceRow> = {};
    for (const key of keys) if (update.patch[key] !== undefined) Object.assign(set, { [key]: update.patch[key] });
    await tx.update(abilityInstances).set(set).where(eq(abilityInstances.id, update.abilityInstanceId));
  }
}

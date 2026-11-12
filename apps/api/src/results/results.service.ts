import { Inject, Injectable } from '@nestjs/common';
import { gameResultsSchema, type GameResults } from '@warewolf/contracts';
import type { Faction } from '@warewolf/domain';
import { and, asc, eq } from 'drizzle-orm';
import { readTallies } from '../day/tallies.js';
import { DATABASE, type Database } from '../db/database.js';
import { eliminationRecords, gamePlayers, games, infectionRecords, nightActions, roleAssignments, victoryRecords } from '../db/schema.js';
import { errors } from '../http/api-error.js';

interface WinnerSummary {
  readonly team?: Faction | null;
  readonly draw?: boolean;
}

/**
 * GET /games/:gameId/results (WW-903a). Reads only stored outcomes: the
 * victory rows and summary written by `applyVictory`, the assignments, and
 * the elimination and infection records. Nothing is re-evaluated, so the
 * recap always agrees with what ended the game.
 */
@Injectable()
export class ResultsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async results(gameId: string): Promise<GameResults> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    const seats = await this.db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)).orderBy(asc(gamePlayers.seatNumber));
    const publicSeat = (s: (typeof seats)[number]) => ({
      playerId: s.id,
      displayName: s.displayName,
      seatNumber: s.seatNumber,
      avatarId: s.avatarId,
      isHost: s.isHost,
    });

    if (game.status === 'CANCELLED') {
      // A cancel never reveals the deal, however far the game got.
      return gameResultsSchema.parse({ status: 'CANCELLED', cancelReason: game.cancelReason ?? 'HOST', seats: seats.map(publicSeat) });
    }
    if (game.status !== 'FINISHED') throw errors.phaseConflict();

    const assignments = await this.db.select().from(roleAssignments).where(eq(roleAssignments.gameId, gameId));
    const deaths = await this.db.select().from(eliminationRecords).where(eq(eliminationRecords.gameId, gameId));
    const wins = await this.db
      .select({ playerId: victoryRecords.playerId })
      .from(victoryRecords)
      .where(and(eq(victoryRecords.gameId, gameId), eq(victoryRecords.scope, 'INDIVIDUAL'), eq(victoryRecords.outcome, 'WIN')));
    const used = await this.db
      .select({ playerId: nightActions.playerId })
      .from(nightActions)
      .where(and(eq(nightActions.gameId, gameId), eq(nightActions.status, 'RESOLVED')));
    const infections = await this.db
      .select()
      .from(infectionRecords)
      .where(and(eq(infectionRecords.gameId, gameId), eq(infectionRecords.outcome, 'SUCCESS')))
      .orderBy(asc(infectionRecords.roundNumber), asc(infectionRecords.createdAt));

    const summary = (game.winnerSummary ?? {}) as WinnerSummary;
    const winningTeam = summary.team ?? null;
    const assignmentOf = new Map(assignments.map((a) => [a.playerId, a]));
    const deathOf = new Map(deaths.map((d) => [d.playerId, d]));
    const individual = new Set(wins.flatMap((w) => (w.playerId ? [w.playerId] : [])));
    const uses = new Map<string, number>();
    for (const row of used) uses.set(row.playerId, (uses.get(row.playerId) ?? 0) + 1);

    return gameResultsSchema.parse({
      status: 'FINISHED',
      roundNumber: game.roundNumber,
      winningTeam,
      draw: summary.draw === true,
      seats: seats.map((s) => {
        const assignment = assignmentOf.get(s.id);
        // Every seat of a started game was dealt in the start transaction.
        if (!assignment) throw new Error(`Seat ${s.id} has no assignment in finished game ${gameId}`);
        const death = deathOf.get(s.id);
        const individualWin = individual.has(s.id);
        return {
          ...publicSeat(s),
          originalRoleId: assignment.originalRoleId,
          originalFaction: assignment.originalFaction,
          finalRoleId: assignment.currentRoleId,
          finalFaction: assignment.currentFaction,
          lifeStatus: s.lifeStatus,
          death: death ? { roundNumber: death.roundNumber, phaseKind: death.phaseKind, roleId: death.roleAtDeath } : null,
          won: individualWin || (winningTeam !== null && assignment.currentFaction === winningTeam),
          individualWin,
          abilityUses: uses.get(s.id) ?? 0,
        };
      }),
      tallies: await readTallies(this.db, gameId),
      infections: infections.map((i) => ({ roundNumber: i.roundNumber, sourcePlayerId: i.sourcePlayerId, targetPlayerId: i.targetPlayerId })),
    });
  }
}

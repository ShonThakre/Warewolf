import { parseGameConfiguration } from '@warewolf/contracts';
import { DEFAULT_CATALOG, evaluateVictory, victoryForSeat, type IndividualVictoryState } from '@warewolf/domain';
import { eq } from 'drizzle-orm';
import { changeAssignment } from '../assignment/assignment.repository.js';
import type { Transaction } from '../db/database.js';
import { gamePlayers, games, roleAssignments, victoryRecords, type GameRow, type RoleAssignmentRow } from '../db/schema.js';

/**
 * Writes the victory evaluator's result (WW-902). Deaths are already on the
 * seats. A night passes no day-vote ids, so a night death cannot win the Jester.
 * Returns whether the game ended. The phase machine turns that into FINISHED
 * and does not open the next phase (OD-68).
 */
export async function applyVictory(tx: Transaction, game: GameRow, dayEliminated: readonly string[]): Promise<boolean> {
  const config = parseGameConfiguration(game.configSnapshot);
  const [stored] = await tx.select().from(games).where(eq(games.id, game.id));
  const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, game.id));
  const assignments = await tx.select().from(roleAssignments).where(eq(roleAssignments.gameId, game.id));
  const byPlayer = new Map(assignments.map((a) => [a.playerId, a]));
  const result = evaluateVictory({
    round: game.roundNumber,
    roundCap: config.roundCap,
    players: players.map((p) => ({ id: p.id, lifeStatus: p.lifeStatus })),
    assignments: assignments.map((a) => ({
      playerId: a.playerId,
      currentRoleId: a.currentRoleId,
      currentProfileId: a.currentProfileId,
      currentFaction: a.currentFaction,
      wolfAligned: a.wolfAligned,
      individualVictory: a.individualVictory,
      markTargetPlayerId: a.markTargetPlayerId,
    })),
    dayEliminated,
    chaosSuccesses: stored?.chaosSuccesses ?? 0,
    chaosAchieved: stored?.chaosAchieved ?? false,
    revivedBy: stored?.revivedBy ?? [],
  });

  const state = new Map<string, IndividualVictoryState>(assignments.map((a) => [a.playerId, a.individualVictory]));
  for (const item of result.individuals) {
    const assignment = byPlayer.get(item.playerId);
    if (!assignment || state.get(item.playerId) === item.state) continue;
    state.set(item.playerId, item.state);
    const reveal = item.state === 'ACHIEVED' && reveals(assignment);
    await changeAssignment(tx, assignment.id, {
      individualVictory: item.state,
      ...(reveal ? { publicReveal: true } : {}),
    });
    if (item.state === 'ACHIEVED') {
      await tx.insert(victoryRecords).values({
        gameId: game.id,
        scope: 'INDIVIDUAL',
        faction: assignment.currentFaction,
        playerId: assignment.playerId,
        roleId: assignment.currentRoleId,
        outcome: 'WIN',
        terminal: result.ended,
      });
    }
  }

  if (result.chaosAchieved && stored && !stored.chaosAchieved) {
    await tx.update(games).set({ chaosAchieved: true }).where(eq(games.id, game.id));
  }

  if (!result.ended) return false;

  if (result.team) {
    await tx.insert(victoryRecords).values({
      gameId: game.id,
      scope: 'TEAM',
      faction: result.team,
      outcome: 'WIN',
      terminal: true,
    });
  } else if (result.draw) {
    await tx.insert(victoryRecords).values({
      gameId: game.id,
      scope: 'TEAM',
      outcome: 'DRAW',
      terminal: true,
    });
  }

  const individuals = assignments
    .filter((a) => state.get(a.playerId) === 'ACHIEVED')
    .map((a) => ({ playerId: a.playerId, roleId: a.currentRoleId }));
  await tx
    .update(games)
    .set({
      winnerSummary: {
        team: result.team,
        draw: result.draw,
        individuals,
      },
    })
    .where(eq(games.id, game.id));
  return true;
}

function reveals(assignment: RoleAssignmentRow): boolean {
  const victory = DEFAULT_CATALOG.byId.get(assignment.currentRoleId)?.profiles[assignment.currentProfileId]?.victory;
  if (!victory) return false;
  const seated = victoryForSeat(victory, assignment.currentFaction);
  return seated.type === 'INDIVIDUAL' && seated.revealOnWin;
}

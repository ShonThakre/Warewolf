import { Injectable } from '@nestjs/common';
import { parseGameConfiguration } from '@warewolf/contracts';
import {
  tallyDay,
  voteWeight,
  type Ballot,
  type DayResolution,
  type GameConfiguration,
  type TallyInput,
  type TallyVote,
} from '@warewolf/domain';
import { and, eq } from 'drizzle-orm';
import type { Transaction } from '../db/database.js';
import {
  abilityInstances,
  eliminationRecords,
  gamePlayers,
  games,
  roleAssignments,
  scheduledEffects,
  votes,
  type AbilityInstanceRow,
  type GamePlayerRow,
  type GameRow,
  type RoleAssignmentRow,
} from '../db/schema.js';
import { applyVictory } from '../victory/apply-victory.js';

/**
 * The day half of a phase close (WW-901, WW-902). Poison that is due, the
 * ballot, and victory run inside the close transaction. A first-ballot tie
 * eliminates nobody. A revote tie eliminates nobody either (OD-40).
 */
@Injectable()
export class DayResolutionService {
  async resolve(tx: Transaction, game: GameRow, ballot: Ballot): Promise<DayResolution> {
    const config = parseGameConfiguration(game.configSnapshot);
    const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, game.id));
    const assignments = await tx.select().from(roleAssignments).where(eq(roleAssignments.gameId, game.id));
    const abilities = await tx.select().from(abilityInstances).where(eq(abilityInstances.gameId, game.id));
    const cast = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.gameId, game.id), eq(votes.roundNumber, game.roundNumber), eq(votes.superseded, false)));

    const life = new Map(players.map((p) => [p.id, p.lifeStatus]));
    const assignmentOf = new Map(assignments.map((a) => [a.playerId, a]));
    const diedNow = new Set<string>();
    const diedByVote: string[] = [];

    const kill = async (playerId: string, causes: { type: 'POISON' | 'DAY_VOTE'; actorIds: string[] }, revengeTarget: string | null) => {
      if (life.get(playerId) !== 'ALIVE') return;
      const immortal = abilities.find(
        (a) => a.playerId === playerId && a.config.capability === 'SURVIVE_DEATH' && a.status === 'ACTIVE' && a.chargesRemaining !== 0,
      );
      if (immortal) {
        await spend(tx, immortal);
        return;
      }
      const assignment = assignmentOf.get(playerId);
      if (!assignment) return;
      life.set(playerId, 'DEAD');
      diedNow.add(playerId);
      await tx.update(gamePlayers).set({ lifeStatus: 'DEAD', diedRound: game.roundNumber }).where(eq(gamePlayers.id, playerId));
      await tx.insert(eliminationRecords).values({
        gameId: game.id,
        roundNumber: game.roundNumber,
        phaseKind: 'DAY',
        playerId,
        roleAtDeath: assignment.currentRoleId,
        originalRoleId: assignment.originalRoleId,
        factionAtDeath: assignment.currentFaction,
        causes: [{ type: causes.type, via: 'EFFECT', actorIds: [...causes.actorIds].sort() }],
        revealedPublicly: config.voting.revealOnDayElimination === 'CURRENT_ROLE',
      });
      if (assignment.currentRoleId === 'alpha_wolf') {
        await tx.update(games).set({ infectionSealed: true }).where(eq(games.id, game.id));
      }
      if (causes.type === 'DAY_VOTE') diedByVote.push(playerId);
      await avenge(tx, game, abilities, life, playerId, revengeTarget);
    };

    const due = await tx
      .select()
      .from(scheduledEffects)
      .where(
        and(
          eq(scheduledEffects.gameId, game.id),
          eq(scheduledEffects.status, 'ACTIVE'),
          eq(scheduledEffects.kind, 'POISON'),
          eq(scheduledEffects.duePhase, 'DAY'),
          eq(scheduledEffects.dueRound, game.roundNumber),
        ),
      );
    for (const effect of due) {
      const alive = life.get(effect.targetPlayerId) === 'ALIVE';
      await kill(effect.targetPlayerId, { type: 'POISON', actorIds: [effect.sourcePlayerId] }, effect.sourcePlayerId);
      await tx
        .update(scheduledEffects)
        .set({ status: alive ? 'SPENT' : 'EXPIRED', closedRound: game.roundNumber })
        .where(eq(scheduledEffects.id, effect.id));
    }

    let tied = false;
    if (ballot === 'FIRST' || ballot === 'REVOTE') {
      const number = ballot === 'FIRST' ? 1 : 2;
      const tallyVotes = (rows: typeof cast): TallyVote[] => rows.map((v) => ({ voterId: v.voterPlayerId, targetId: v.targetPlayerId }));
      const input = (dayBallot: 'FIRST' | 'REVOTE', rows: typeof cast): TallyInput => ({
        round: game.roundNumber,
        ballot: dayBallot,
        players: [...life].map(([id, lifeStatus]) => ({ id, lifeStatus })),
        assignments: assignments.map((a) => ({ playerId: a.playerId, currentRoleId: a.currentRoleId, currentProfileId: a.currentProfileId })),
        abilities: abilities.map((a) => ({ playerId: a.playerId, status: a.status, config: a.config })),
        votes: tallyVotes(rows),
        ...(config.voting.deadMayVote ? { countDeadVotes: true } : {}),
      });

      const first = cast.filter((v) => v.ballot === 1);
      const allowed = ballot === 'REVOTE' ? new Set(tallyDay(input('FIRST', first)).tied) : null;
      const active = cast.filter((v) => v.ballot === number && (allowed === null || v.targetPlayerId === null || allowed.has(v.targetPlayerId)));
      const result = tallyDay(input(ballot, active));
      tied = result.tied.length > 0;
      if (result.eliminated) {
        const voters = active.filter((v) => v.targetPlayerId === result.eliminated);
        const leader = uniqueLeader(voters, abilities);
        await kill(result.eliminated, { type: 'DAY_VOTE', actorIds: voters.map((v) => v.voterPlayerId) }, leader);
      }
      for (const vote of active) {
        await tx.update(votes).set({ weight: voteWeight(vote.voterPlayerId, input(ballot, active).abilities) }).where(eq(votes.id, vote.id));
      }
    }

    await inheritDoctors(tx, game, assignments, abilities, life, diedNow);
    const gameOver = await applyVictory(tx, game, diedByVote);
    return { gameOver, tied: gameOver ? false : tied };
  }
}

/** The players a revote may name: the first ballot's tie, recomputed from the stored votes. */
export async function revoteTargets(tx: Transaction, game: GameRow, config: GameConfiguration): Promise<ReadonlySet<string>> {
  const players = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, game.id));
  const assignments = await tx.select().from(roleAssignments).where(eq(roleAssignments.gameId, game.id));
  const abilities = await tx.select().from(abilityInstances).where(eq(abilityInstances.gameId, game.id));
  const cast = await tx
    .select()
    .from(votes)
    .where(and(eq(votes.gameId, game.id), eq(votes.roundNumber, game.roundNumber), eq(votes.ballot, 1), eq(votes.superseded, false)));
  const result = tallyDay({
    round: game.roundNumber,
    ballot: 'FIRST',
    players: players.map((p) => ({ id: p.id, lifeStatus: p.lifeStatus })),
    assignments: assignments.map((a) => ({ playerId: a.playerId, currentRoleId: a.currentRoleId, currentProfileId: a.currentProfileId })),
    abilities: abilities.map((a) => ({ playerId: a.playerId, status: a.status, config: a.config })),
    votes: cast.map((v) => ({ voterId: v.voterPlayerId, targetId: v.targetPlayerId })),
    ...(config.voting.deadMayVote ? { countDeadVotes: true } : {}),
  });
  return new Set(result.tied);
}

/** The one voter who put the most weight on this player, when nobody else matched it. */
function uniqueLeader(voters: { voterPlayerId: string; weight: number }[], abilities: readonly AbilityInstanceRow[]): string | null {
  const tallyAbilities = abilities.map((a) => ({ playerId: a.playerId, status: a.status, config: a.config }));
  const scored = voters.map((v) => ({ id: v.voterPlayerId, weight: voteWeight(v.voterPlayerId, tallyAbilities) }));
  const top = Math.max(0, ...scored.map((s) => s.weight));
  const leaders = scored.filter((s) => s.weight === top && s.weight > 0);
  const ids = new Set(leaders.map((s) => s.id));
  return ids.size === 1 ? leaders[0]!.id : null;
}

async function spend(tx: Transaction, ability: AbilityInstanceRow): Promise<void> {
  const next = ability.chargesRemaining === null ? null : Math.max(0, ability.chargesRemaining - 1);
  ability.chargesRemaining = next;
  ability.usesConsumed += 1;
  if (next === 0) ability.status = 'EXHAUSTED';
  await tx
    .update(abilityInstances)
    .set({ chargesRemaining: next, usesConsumed: ability.usesConsumed, status: ability.status })
    .where(eq(abilityInstances.id, ability.id));
}

async function avenge(
  tx: Transaction,
  game: GameRow,
  abilities: AbilityInstanceRow[],
  life: Map<string, GamePlayerRow['lifeStatus']>,
  deadId: string,
  targetId: string | null,
): Promise<void> {
  const avenger = abilities.find((a) => a.playerId === deadId && a.config.capability === 'REVENGE' && a.status === 'ACTIVE' && a.chargesRemaining !== 0);
  if (!avenger) return;
  await spend(tx, avenger);
  if (!targetId || targetId === deadId || life.get(targetId) !== 'ALIVE') return;
  await tx.insert(scheduledEffects).values({
    gameId: game.id,
    kind: 'REVENGE',
    sourcePlayerId: deadId,
    sourceAbilityInstanceId: avenger.id,
    targetPlayerId: targetId,
    createdRound: game.roundNumber,
    dueRound: game.roundNumber + 1,
    duePhase: 'NIGHT',
    attackTypes: [avenger.config.attackType ?? 'REVENGE'],
  });
}

/** A Doctor who died in this resolution hands the remaining save to a living Healer Assistant (OD-32). */
async function inheritDoctors(
  tx: Transaction,
  game: GameRow,
  assignments: readonly RoleAssignmentRow[],
  abilities: AbilityInstanceRow[],
  life: Map<string, GamePlayerRow['lifeStatus']>,
  diedNow: ReadonlySet<string>,
): Promise<void> {
  const taken = new Set<string>();
  const assistants = abilities
    .filter((a) => a.config.handlerKey === 'assistant.inheritDoctor' && a.status === 'ACTIVE' && a.chargesRemaining !== 0)
    .sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  for (const assistant of assistants) {
    if (life.get(assistant.playerId) !== 'ALIVE') continue;
    const roleId = assistant.config.config['inheritsRoleId'];
    if (typeof roleId !== 'string') continue;
    const doctor = assignments
      .filter((a) => a.currentRoleId === roleId && diedNow.has(a.playerId) && !taken.has(a.playerId))
      .sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0))[0];
    if (!doctor) continue;
    if (abilities.some((a) => a.source === 'INHERITED' && a.sourcePlayerId === doctor.playerId)) continue;
    const heir = assignments.find((a) => a.playerId === assistant.playerId);
    if (!heir) continue;
    const inherited = abilities.filter((a) => a.playerId === doctor.playerId && a.source === 'NATIVE' && a.status !== 'REVOKED');
    if (inherited.length > 0) {
      await tx.insert(abilityInstances).values(
        inherited.map((a) => ({
          gameId: game.id,
          playerId: heir.playerId,
          assignmentId: heir.id,
          abilityId: a.abilityId,
          capability: a.capability,
          handlerKey: a.handlerKey,
          status: a.chargesRemaining === 0 ? ('EXHAUSTED' as const) : ('ACTIVE' as const),
          chargesRemaining: a.chargesRemaining,
          availableFromRound: game.roundNumber + 1,
          expiresRound: null,
          source: 'INHERITED' as const,
          sourcePlayerId: doctor.playerId,
          config: a.config,
        })),
      );
    }
    taken.add(doctor.playerId);
    await spend(tx, assistant);
  }
}

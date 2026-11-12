import { Injectable } from '@nestjs/common';
import { parseGameConfiguration } from '@warewolf/contracts';
import {
  nightShields,
  resolveShots,
  tallyDay,
  voteWeight,
  type NightProtection,
  type Ballot,
  type DayResolution,
  type GameConfiguration,
  type TallyInput,
  type TallyVote,
} from '@warewolf/domain';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Transaction } from '../db/database.js';
import {
  abilityInstances,
  dayTallies,
  eliminationRecords,
  gamePlayers,
  games,
  nightActions,
  resolutionRuns,
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

    const kill = async (playerId: string, causes: { type: 'POISON' | 'DAY_VOTE' | 'SNIPER'; actorIds: string[] }, revengeTarget: string | null) => {
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
        causes: [{ type: causes.type, via: causes.type === 'SNIPER' ? 'ABILITY' : 'EFFECT', actorIds: [...causes.actorIds].sort() }],
        revealedPublicly: config.voting.revealOnDayElimination === 'CURRENT_ROLE',
      });
      if (assignment.currentRoleId === 'alpha_wolf') {
        await tx.update(games).set({ infectionSealed: true }).where(eq(games.id, game.id));
      }
      if (causes.type === 'DAY_VOTE') diedByVote.push(playerId);
      await avenge(tx, game, abilities, life, playerId, revengeTarget);
    };

    // Day shots (OD-29) resolve when discussion closes, before voting opens, or at the day's end when voting is off.
    if (ballot === 'DISCUSSION' || ballot === 'NONE') await this.fireShots(tx, game, abilities, life, kill);
    if (ballot === 'DISCUSSION') {
      await inheritDoctors(tx, game, assignments, abilities, life, diedNow);
      // A shot never wins a Jester: only a day vote does.
      return { gameOver: await applyVictory(tx, game, []), tied: false };
    }

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
      const chaosRows = await tx
        .select()
        .from(scheduledEffects)
        .where(
          and(
            eq(scheduledEffects.gameId, game.id),
            eq(scheduledEffects.status, 'ACTIVE'),
            eq(scheduledEffects.kind, 'CHAOS_DAY'),
            eq(scheduledEffects.duePhase, 'DAY'),
            eq(scheduledEffects.dueRound, game.roundNumber),
          ),
        );
      const dayChaos = chaosRows.flatMap((row) => {
        if (row.chaosKind !== 'NO_VOTE' && row.chaosKind !== 'SWAP_VOTES' && row.chaosKind !== 'DOUBLE_VOTE') return [];
        return [{ row, effect: { kind: row.chaosKind, playerIds: row.playerIds ?? [] } }];
      });
      const mindRows = await tx
        .select()
        .from(nightActions)
        .where(
          and(
            eq(nightActions.gameId, game.id),
            eq(nightActions.roundNumber, game.roundNumber),
            eq(nightActions.phase, 'DAY_DISCUSSION'),
            eq(nightActions.status, 'LOCKED'),
          ),
        );
      const mindControl = mindRows.flatMap((row) => {
        const ability = abilities.find((item) => item.id === row.abilityInstanceId);
        if (ability?.config.capability !== 'MODIFY_VOTING' || row.targetPlayerIds.length < 2) return [];
        return [{ row, control: { voterId: row.targetPlayerIds[0]!, targetId: row.targetPlayerIds[1]! } }];
      });
      const number = ballot === 'FIRST' ? 1 : 2;
      const tallyVotes = (rows: typeof cast): TallyVote[] => rows.map((v) => ({ voterId: v.voterPlayerId, targetId: v.targetPlayerId }));
      const input = (dayBallot: 'FIRST' | 'REVOTE', rows: typeof cast): TallyInput => ({
        round: game.roundNumber,
        ballot: dayBallot,
        players: [...life].map(([id, lifeStatus]) => ({ id, lifeStatus })),
        assignments: assignments.map((a) => ({ playerId: a.playerId, currentRoleId: a.currentRoleId, currentProfileId: a.currentProfileId })),
        abilities: abilities.map((a) => ({ playerId: a.playerId, status: a.status, config: a.config })),
        votes: tallyVotes(rows),
        ...(dayChaos.length > 0 ? { chaosEffects: dayChaos.map((item) => item.effect) } : {}),
        ...(mindControl.length > 0 ? { mindControl: mindControl.map((item) => item.control) } : {}),
        ...(config.voting.deadMayVote ? { countDeadVotes: true } : {}),
      });

      const first = cast.filter((v) => v.ballot === 1);
      const allowed = ballot === 'REVOTE' ? new Set(tallyDay(input('FIRST', first)).tied) : null;
      const active = cast.filter((v) => v.ballot === number && (allowed === null || v.targetPlayerId === null || allowed.has(v.targetPlayerId)));
      const result = tallyDay(input(ballot, active));
      tied = result.tied.length > 0;
      // The public tally (OD-85): the totals that decided this ballot, with no voter ids.
      const counted = (voterId: string) => config.voting.deadMayVote || life.get(voterId) === 'ALIVE';
      await tx.insert(dayTallies).values({
        gameId: game.id,
        roundNumber: game.roundNumber,
        ballot: number,
        counts: Object.entries(result.counts)
          .filter(([, total]) => total > 0)
          .map(([targetPlayerId, total]) => ({ targetPlayerId, total }))
          .sort((a, b) => b.total - a.total || (a.targetPlayerId < b.targetPlayerId ? -1 : 1)),
        abstentions: active.filter((v) => v.targetPlayerId === null && counted(v.voterPlayerId)).length,
        votedOutPlayerId: result.eliminated,
        tiedPlayerIds: [...result.tied],
      });
      if (result.eliminated) {
        const voters = active.filter((v) => v.targetPlayerId === result.eliminated);
        const leader = uniqueLeader(voters, abilities);
        await kill(result.eliminated, { type: 'DAY_VOTE', actorIds: voters.map((v) => v.voterPlayerId) }, leader);
      }
      for (const vote of active) {
        await tx.update(votes).set({ weight: voteWeight(vote.voterPlayerId, input(ballot, active).abilities) }).where(eq(votes.id, vote.id));
      }
      const opensRevote = ballot === 'FIRST' && result.tied.length > 0;
      let credit = 0;
      for (let i = 0; i < dayChaos.length; i++) {
        const item = dayChaos[i]!;
        if (!result.chaosOutcomes[i]?.applied || item.row.chaosCounted) continue;
        credit += 1;
        await tx.update(scheduledEffects).set({ chaosCounted: true }).where(eq(scheduledEffects.id, item.row.id));
      }
      if (credit > 0) {
        await tx.update(games).set({ chaosSuccesses: sql`${games.chaosSuccesses} + ${credit}` }).where(eq(games.id, game.id));
      }
      if (!opensRevote) {
        for (const item of dayChaos) {
          await tx.update(scheduledEffects).set({ status: 'SPENT', closedRound: game.roundNumber }).where(eq(scheduledEffects.id, item.row.id));
        }
        for (const item of mindControl) {
          await tx.update(nightActions).set({ status: 'RESOLVED', rejectedReason: null }).where(eq(nightActions.id, item.row.id));
        }
      }
    }

    await inheritDoctors(tx, game, assignments, abilities, life, diedNow);
    const gameOver = await applyVictory(tx, game, diedByVote);
    return { gameOver, tied: gameOver ? false : tied };
  }

  /**
   * Resolves this day's locked Sniper shots in submission order (WW-1003b).
   * A protection that resolved on the target last night and cancels `SNIPER`
   * stops the shot; an Immortal survives it inside `kill`. Every shot is spent
   * when it is fired, hit or not, and its action is marked RESOLVED.
   */
  private async fireShots(
    tx: Transaction,
    game: GameRow,
    abilities: AbilityInstanceRow[],
    life: Map<string, GamePlayerRow['lifeStatus']>,
    kill: (playerId: string, causes: { type: 'SNIPER'; actorIds: string[] }, revengeTarget: string | null) => Promise<void>,
  ): Promise<void> {
    const byId = new Map(abilities.map((a) => [a.id, a]));
    const locked = await tx
      .select()
      .from(nightActions)
      .where(and(eq(nightActions.gameId, game.id), eq(nightActions.roundNumber, game.roundNumber), eq(nightActions.phase, 'DAY_DISCUSSION'), eq(nightActions.status, 'LOCKED')))
      .orderBy(asc(nightActions.createdAt));
    const shotRows = locked.filter((row) => {
      const config = byId.get(row.abilityInstanceId)?.config;
      return config?.capability === 'KILL' && config.attackType === 'SNIPER' && row.targetPlayerIds.length === 1;
    });
    if (shotRows.length === 0) return;

    const lastNight = await tx
      .select()
      .from(nightActions)
      .where(
        and(
          eq(nightActions.gameId, game.id),
          eq(nightActions.roundNumber, game.roundNumber),
          inArray(nightActions.phase, ['NIGHT_SUBMIT', 'NIGHT_REACTION']),
          eq(nightActions.status, 'RESOLVED'),
        ),
      );
    const protections: NightProtection[] = lastNight.flatMap((row) => {
      const config = byId.get(row.abilityInstanceId)?.config;
      if (!config) return [];
      return [{ cancels: config.cancels, targetPlayerIds: row.targetPlayerIds, onFinalWolfTarget: config.target.kind === 'FINAL_WOLF_TARGET' }];
    });
    const [run] = await tx
      .select({ result: resolutionRuns.result })
      .from(resolutionRuns)
      .where(and(eq(resolutionRuns.gameId, game.id), eq(resolutionRuns.roundNumber, game.roundNumber), eq(resolutionRuns.phaseKind, 'NIGHT')));
    const finalWolfTarget = (run?.result as { finalWolfTarget?: string | null } | undefined)?.finalWolfTarget ?? null;
    const shielded = nightShields(protections, finalWolfTarget);

    const outcomes = resolveShots(
      shotRows.map((row) => ({ actionId: row.id, actorId: row.playerId, targetId: row.targetPlayerIds[0]! })),
      life,
      shielded,
    );
    for (const shot of outcomes) {
      if (shot.outcome === 'HIT') await kill(shot.targetId, { type: 'SNIPER', actorIds: [shot.actorId] }, shot.actorId);
      await tx.update(nightActions).set({ status: 'RESOLVED' }).where(eq(nightActions.id, shot.actionId));
      const ability = byId.get(shotRows.find((r) => r.id === shot.actionId)!.abilityInstanceId);
      if (ability) await spend(tx, ability);
    }
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

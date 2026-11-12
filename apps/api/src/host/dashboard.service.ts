import { Inject, Injectable } from '@nestjs/common';
import { hostDashboardSchema, parseGameConfiguration, type DashboardBallot, type HostDashboard } from '@warewolf/contracts';
import { voteWeight, type Faction } from '@warewolf/domain';
import { and, asc, eq, ne } from 'drizzle-orm';
import { RoleViewService } from '../assignment/role-view.service.js';
import { DATABASE, type Database } from '../db/database.js';
import { abilityInstances, eliminationRecords, gamePlayers, games, infectionRecords, nightActions, roleAssignments, votes, type GamePlayerRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';

/**
 * GET /games/:gameId/host/dashboard (WW-1202a). Host only. Reads stored
 * rows; nothing is resolved or re-evaluated here. The roster comes from the
 * same view as GET /host/roster, so the two never disagree.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(RoleViewService) private readonly views: RoleViewService,
  ) {}

  async dashboard(gameId: string, seat: GamePlayerRow): Promise<HostDashboard> {
    // 403 for a non-host and 409 before the deal, exactly as the roster route.
    const roster = await this.views.roster(gameId, seat);
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    const config = parseGameConfiguration(game.configSnapshot);

    const players = await this.db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
    const assignments = await this.db.select().from(roleAssignments).where(eq(roleAssignments.gameId, gameId));
    const abilities = await this.db.select().from(abilityInstances).where(eq(abilityInstances.gameId, gameId));
    const submissions = await this.db
      .select()
      .from(nightActions)
      .where(and(eq(nightActions.gameId, gameId), eq(nightActions.roundNumber, game.roundNumber), ne(nightActions.status, 'CANCELLED')))
      .orderBy(asc(nightActions.createdAt));
    const infections = await this.db
      .select()
      .from(infectionRecords)
      .where(eq(infectionRecords.gameId, gameId))
      .orderBy(asc(infectionRecords.roundNumber), asc(infectionRecords.createdAt));
    const cast = await this.db
      .select()
      .from(votes)
      .where(and(eq(votes.gameId, gameId), eq(votes.superseded, false)))
      .orderBy(asc(votes.roundNumber), asc(votes.ballot), asc(votes.submittedAt));
    const deaths = await this.db
      .select()
      .from(eliminationRecords)
      .where(eq(eliminationRecords.gameId, gameId))
      .orderBy(asc(eliminationRecords.roundNumber), asc(eliminationRecords.createdAt));

    const alive = new Set(players.filter((p) => p.lifeStatus === 'ALIVE').map((p) => p.id));
    const openBallot = game.status === 'ACTIVE' ? (game.phase === 'VOTING' ? 1 : game.phase === 'REVOTE' ? 2 : null) : null;
    const tallyAbilities = abilities.map((a) => ({ playerId: a.playerId, status: a.status, config: a.config }));

    const ballots = new Map<string, DashboardBallot>();
    for (const vote of cast) {
      const ballot = vote.ballot === 2 ? 2 : 1;
      const key = `${vote.roundNumber}:${ballot}`;
      const open = openBallot === ballot && vote.roundNumber === game.roundNumber;
      const entry = ballots.get(key) ?? { roundNumber: vote.roundNumber, ballot, open, votes: [], counts: [] };
      // Weights are written onto the rows when a ballot closes; an open ballot shows the voter's weight as of now.
      const weight = open ? voteWeight(vote.voterPlayerId, tallyAbilities) : vote.weight;
      entry.votes.push({ voterPlayerId: vote.voterPlayerId, targetPlayerId: vote.targetPlayerId, weight });
      ballots.set(key, entry);
    }
    for (const entry of ballots.values()) {
      const totals = new Map<string | null, number>();
      for (const vote of entry.votes) totals.set(vote.targetPlayerId, (totals.get(vote.targetPlayerId) ?? 0) + vote.weight);
      entry.counts = [...totals]
        .map(([targetPlayerId, total]) => ({ targetPlayerId, total }))
        .sort((a, b) => b.total - a.total || String(a.targetPlayerId).localeCompare(String(b.targetPlayerId)));
    }

    const summary = game.winnerSummary as { team?: Faction | null; draw?: boolean } | null;

    return hostDashboardSchema.parse({
      overview: {
        status: game.status,
        phase: game.phase,
        roundNumber: game.roundNumber,
        stateVersion: game.stateVersion,
        phaseEndsAt: game.phaseEndsAt?.toISOString() ?? null,
        alive: alive.size,
        wolfAlignedAlive: assignments.filter((a) => a.wolfAligned && alive.has(a.playerId)).length,
        infection: {
          enabled: config.infection.enabled,
          successes: game.infectionSuccesses,
          max: config.infection.maxSuccesses,
          sealed: game.infectionSealed,
        },
      },
      roster,
      submissions: submissions.map((a) => ({
        actionId: a.id,
        playerId: a.playerId,
        abilityId: abilities.find((i) => i.id === a.abilityInstanceId)?.abilityId ?? 'unknown',
        window: a.phase,
        targetPlayerIds: a.targetPlayerIds,
        status: a.status,
        rejectedReason: a.rejectedReason,
        submittedAt: a.createdAt.toISOString(),
      })),
      infections: infections.map((i) => ({
        roundNumber: i.roundNumber,
        sourcePlayerId: i.sourcePlayerId,
        targetPlayerId: i.targetPlayerId,
        outcome: i.outcome,
        failureReason: i.failureReason,
      })),
      ballots: [...ballots.values()],
      eliminations: deaths.map((d) => ({
        roundNumber: d.roundNumber,
        phaseKind: d.phaseKind,
        playerId: d.playerId,
        roleAtDeath: d.roleAtDeath,
        factionAtDeath: d.factionAtDeath,
        causes: d.causes.map((c) => ({ type: c.type, via: c.via, actorIds: [...c.actorIds] })),
        revealedPublicly: d.revealedPublicly,
      })),
      victory: {
        outcome: game.status === 'FINISHED' ? { team: summary?.team ?? null, draw: summary?.draw === true } : null,
        individuals: assignments
          .filter((a) => a.individualVictory !== 'NONE')
          .map((a) => ({ playerId: a.playerId, roleId: a.currentRoleId, state: a.individualVictory })),
      },
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { gameLogSchema, type GameLog } from '@warewolf/contracts';
import type { Faction } from '@warewolf/domain';
import { and, asc, eq, or } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import {
  abilityInstances,
  eliminationRecords,
  gameEvents,
  gamePlayers,
  games,
  infectionRecords,
  investigationRecords,
  nightActions,
  resolutionRuns,
  roleAssignments,
  roleConversionRecords,
  votes,
  type GamePlayerRow,
} from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { composeLog, type LogActionRow, type LogEventRow, type LogVoteRow, type RevealedRows } from './compose.js';

/**
 * LOG-01: loads what one seat may see and composes the log.
 *
 * - `forSeat`: PUBLIC rows, the seat's own PLAYER rows, its own actions and
 *   ballots. Every secret is added only once the game is FINISHED.
 * - `forHost`: the same plus every secret while the game runs. The host
 *   dashboard already shows them; HOST rows themselves are still not read.
 *
 * The result is parsed through the strict contract, so a field the contract
 * does not name cannot leave.
 */
@Injectable()
export class LogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async forSeat(gameId: string, seat: GamePlayerRow): Promise<GameLog> {
    return this.compose(gameId, seat, false);
  }

  async forHost(gameId: string, seat: GamePlayerRow): Promise<GameLog> {
    const [current] = await this.db.select({ isHost: gamePlayers.isHost }).from(gamePlayers).where(eq(gamePlayers.id, seat.id));
    if (!current?.isHost) throw errors.notHost();
    return this.compose(gameId, seat, true);
  }

  private async compose(gameId: string, seat: GamePlayerRow, host: boolean): Promise<GameLog> {
    const [game] = await this.db.select({ status: games.status }).from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    const seats = await this.db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)).orderBy(asc(gamePlayers.seatNumber));
    const events = await this.db
      .select({ seq: gameEvents.seq, type: gameEvents.type, audience: gameEvents.audience, payload: gameEvents.payload, createdAt: gameEvents.createdAt })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.gameId, gameId),
          or(eq(gameEvents.audience, 'PUBLIC'), and(eq(gameEvents.audience, 'PLAYER'), eq(gameEvents.recipientPlayerId, seat.id))),
        ),
      )
      .orderBy(asc(gameEvents.seq));

    const reveal = host || game.status === 'FINISHED';
    const own = reveal
      ? { actions: [], votes: [] }
      : { actions: await this.actions(gameId, seat.id), votes: await this.votes(gameId, seat.id) };
    const log = composeLog({
      status: game.status,
      seats: seats.map((s) => ({ playerId: s.id, displayName: s.displayName, seatNumber: s.seatNumber, avatarId: s.avatarId })),
      events: events as LogEventRow[],
      own,
      revealed: reveal ? await this.revealed(gameId) : null,
    });
    return gameLogSchema.parse(log);
  }

  private async actions(gameId: string, playerId?: string): Promise<LogActionRow[]> {
    return this.db
      .select({
        id: nightActions.id,
        playerId: nightActions.playerId,
        roundNumber: nightActions.roundNumber,
        phase: nightActions.phase,
        abilityId: abilityInstances.abilityId,
        targetPlayerIds: nightActions.targetPlayerIds,
        status: nightActions.status,
        createdAt: nightActions.createdAt,
      })
      .from(nightActions)
      .innerJoin(abilityInstances, eq(abilityInstances.id, nightActions.abilityInstanceId))
      .where(playerId ? and(eq(nightActions.gameId, gameId), eq(nightActions.playerId, playerId)) : eq(nightActions.gameId, gameId))
      .orderBy(asc(nightActions.createdAt));
  }

  private async votes(gameId: string, voterId?: string): Promise<LogVoteRow[]> {
    const live = and(eq(votes.gameId, gameId), eq(votes.superseded, false));
    return this.db
      .select({
        id: votes.id,
        voterPlayerId: votes.voterPlayerId,
        roundNumber: votes.roundNumber,
        ballot: votes.ballot,
        targetPlayerId: votes.targetPlayerId,
        submittedAt: votes.submittedAt,
      })
      .from(votes)
      .where(voterId ? and(live, eq(votes.voterPlayerId, voterId)) : live)
      .orderBy(asc(votes.submittedAt));
  }

  private async revealed(gameId: string): Promise<RevealedRows> {
    const roles = await this.db.select().from(roleAssignments).where(eq(roleAssignments.gameId, gameId));
    const eliminations = await this.db.select().from(eliminationRecords).where(eq(eliminationRecords.gameId, gameId));
    const infections = await this.db.select().from(infectionRecords).where(eq(infectionRecords.gameId, gameId));
    const conversions = await this.db.select().from(roleConversionRecords).where(eq(roleConversionRecords.gameId, gameId));
    const investigations = await this.db.select().from(investigationRecords).where(eq(investigationRecords.gameId, gameId));
    const owners = await this.db.select({ id: abilityInstances.id, playerId: abilityInstances.playerId }).from(abilityInstances).where(eq(abilityInstances.gameId, gameId));
    const ownerOf = new Map(owners.map((o) => [o.id, o.playerId]));
    const nights = await this.db
      .select({ roundNumber: resolutionRuns.roundNumber, result: resolutionRuns.result, createdAt: resolutionRuns.createdAt })
      .from(resolutionRuns)
      .where(and(eq(resolutionRuns.gameId, gameId), eq(resolutionRuns.phaseKind, 'NIGHT')));

    return {
      roles: roles.map((r) => ({ playerId: r.playerId, roleId: r.originalRoleId, faction: r.originalFaction, at: r.createdAt })),
      actions: await this.actions(gameId),
      votes: await this.votes(gameId),
      eliminations: eliminations.map((e) => ({
        id: e.id,
        playerId: e.playerId,
        roundNumber: e.roundNumber,
        phaseKind: e.phaseKind,
        roleAtDeath: e.roleAtDeath,
        factionAtDeath: e.factionAtDeath,
        causes: e.causes.map((c) => ({ type: c.type, actorIds: [...c.actorIds] })),
        at: e.createdAt,
      })),
      saves: nights.flatMap((run) =>
        savesOf(run.result).map((save) => ({
          roundNumber: run.roundNumber,
          playerId: save.playerId,
          attackType: save.attackType,
          saverIds: save.savedBy.flatMap((abilityId) => {
            const owner = ownerOf.get(abilityId);
            return owner ? [owner] : [];
          }),
          at: run.createdAt,
        })),
      ),
      infections: infections.map((i) => ({
        id: i.id,
        roundNumber: i.roundNumber,
        sourcePlayerId: i.sourcePlayerId,
        targetPlayerId: i.targetPlayerId,
        outcome: i.outcome,
        at: i.createdAt,
      })),
      conversions: conversions.map((c) => ({
        id: c.id,
        roundNumber: c.roundNumber,
        playerId: c.playerId,
        toRoleId: c.toRoleId,
        toFaction: c.toFaction as Faction,
        reason: c.reason,
        at: c.createdAt,
      })),
      investigations: investigations.map((i) => ({
        id: i.id,
        roundNumber: i.roundNumber,
        actorPlayerId: i.actorPlayerId,
        abilityId: i.abilityId,
        targetPlayerIds: [...i.targetPlayerIds],
        result: i.result,
        at: i.createdAt,
      })),
    };
  }
}

/** The `saves` the night resolver stored (domain `Save`). Anything malformed is skipped. */
function savesOf(result: unknown): { playerId: string; attackType: string; savedBy: string[] }[] {
  const saves = (result as { saves?: unknown } | null)?.saves;
  if (!Array.isArray(saves)) return [];
  return saves.flatMap((s: { playerId?: unknown; attackType?: unknown; savedBy?: unknown }) =>
    typeof s?.playerId === 'string' && typeof s.attackType === 'string'
      ? [{ playerId: s.playerId, attackType: s.attackType, savedBy: Array.isArray(s.savedBy) ? s.savedBy.filter((x): x is string => typeof x === 'string') : [] }]
      : [],
  );
}

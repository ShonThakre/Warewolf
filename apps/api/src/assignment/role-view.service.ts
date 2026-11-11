import { Inject, Injectable } from '@nestjs/common';
import { hostRosterSchema, myRoleSchema, parseGameConfiguration, type HostRoster, type MyRole } from '@warewolf/contracts';
import { and, asc, eq, ne } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers, games, roleAssignments, type GamePlayerRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { gameAssignments, playerAssignment } from './assignment.repository.js';
import { hostRosterView, ownRoleView, teammatesVisible } from './projections.js';

/**
 * Reads behind GET /games/:gameId/me and GET /games/:gameId/host/roster (WW-403).
 *
 * Each response is parsed through its contract before it leaves, so a field
 * the contract does not name (a stray row, a debug value) is dropped rather
 * than sent.
 */
@Injectable()
export class RoleViewService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** The caller's own role. 409 before the deal. */
  async me(gameId: string, seat: GamePlayerRow): Promise<MyRole> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    const own = await playerAssignment(this.db, seat.id);
    if (!own) throw errors.phaseConflict();

    const visible = teammatesVisible(parseGameConfiguration(game.configSnapshot), own.assignment);
    // Only seats, never roles: the query does not select a single role column.
    const teammates = visible
      ? await this.db
          .select({ id: gamePlayers.id, displayName: gamePlayers.displayName, seatNumber: gamePlayers.seatNumber })
          .from(roleAssignments)
          .innerJoin(gamePlayers, eq(gamePlayers.id, roleAssignments.playerId))
          .where(
            and(
              eq(roleAssignments.gameId, game.id),
              eq(roleAssignments.currentFaction, 'WOLF_PACK'),
              ne(roleAssignments.playerId, seat.id),
            ),
          )
          .orderBy(asc(gamePlayers.seatNumber))
      : [];

    return myRoleSchema.parse(
      ownRoleView({ game, you: seat, assignment: own.assignment, abilities: own.abilities, teammatesVisible: visible, teammates }),
    );
  }

  /** Every role in the game. 403 for anyone but the host, 409 before the deal. */
  async roster(gameId: string, seat: GamePlayerRow): Promise<HostRoster> {
    if (!seat.isHost) throw errors.notHost();
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();

    const { assignments, abilities } = await gameAssignments(this.db, game.id);
    if (assignments.length === 0) throw errors.phaseConflict();
    const seats = await this.db.select().from(gamePlayers).where(eq(gamePlayers.gameId, game.id));
    return hostRosterSchema.parse(hostRosterView({ game, seats, assignments, abilities }));
  }
}

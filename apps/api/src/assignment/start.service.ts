import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { StartGameResponse } from '@warewolf/contracts';
import { DEFAULT_CATALOG, canStart, dealRoles, validateConfiguration, type RandomInt } from '@warewolf/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers, games, type GamePlayerRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { LobbyService } from '../lobby/lobby.service.js';
import { insertDeal } from './assignment.repository.js';

/**
 * The random source for the deal. Production binds `cryptoRandomInt`. Tests
 * may bind a scripted source through `createApp`; no request can reach it.
 */
export const DEAL_RANDOM = Symbol('DEAL_RANDOM');

/** node:crypto's CSPRNG, uniform over `[0, max)`. */
export const cryptoRandomInt: RandomInt = (max) => randomInt(max);

/**
 * POST /games/:gameId/start (WW-402). One transaction, under the game row lock:
 * check the host and the lobby, validate the draft again, check the seats and
 * the warning acknowledgement, deal, write the assignments, freeze the
 * configuration, and move to ROLE_REVEAL. The seed is never stored; the rows
 * are the record (data-model.md, section 7).
 */
@Injectable()
export class StartService {
  private readonly logger = new Logger('Start');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LobbyService) private readonly lobby: LobbyService,
    @Inject(DEAL_RANDOM) private readonly random: RandomInt,
  ) {}

  async start(gameId: string, seat: GamePlayerRow, acknowledgeWarnings: boolean): Promise<StartGameResponse> {
    const started = await this.db.transaction(async (tx) => {
      const { game, you } = await this.lobby.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'LOBBY') throw errors.gameStarted();

      const config = this.lobby.draft(game);
      const validation = validateConfiguration(config);
      if (!validation.valid) throw errors.configInvalid();

      const seats = await tx
        .select({ id: gamePlayers.id })
        .from(gamePlayers)
        .where(eq(gamePlayers.gameId, game.id))
        .orderBy(asc(gamePlayers.seatNumber));
      if (seats.length !== config.playerCount) throw errors.seatCountMismatch();
      if (!canStart(validation, { acknowledgeWarnings })) throw errors.warningsUnacknowledged();

      await insertDeal(tx, game.id, dealRoles(config, seats.map((s) => s.id), this.random));

      const now = new Date();
      const [updated] = await tx
        .update(games)
        .set({
          status: 'ACTIVE',
          phase: 'ROLE_REVEAL',
          roundNumber: 1,
          configSnapshot: config,
          catalogHash: DEFAULT_CATALOG.hash,
          phaseStartedAt: now,
          phaseEndsAt: null,
          stateVersion: sql`${games.stateVersion} + 1`,
          updatedAt: now,
        })
        // The lock already serializes this; the version guard is the transition rule every phase change follows.
        .where(and(eq(games.id, game.id), eq(games.stateVersion, game.stateVersion)))
        .returning();
      if (!updated) throw errors.phaseConflict();
      return { game: updated, players: seats.length };
    });

    // Ids and counts only: role names stay out of logs (data-model.md, section 6).
    this.logger.log(`started game=${started.game.id} players=${started.players}`);
    return {
      gameId: started.game.id,
      status: started.game.status,
      phase: started.game.phase,
      roundNumber: started.game.roundNumber,
      stateVersion: started.game.stateVersion,
    };
  }
}

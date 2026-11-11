import { Inject, Injectable } from '@nestjs/common';
import { castVoteResponseSchema, parseGameConfiguration, type CastVoteRequest, type CastVoteResponse } from '@warewolf/contracts';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers, votes, type GamePlayerRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { LobbyService } from '../lobby/lobby.service.js';
import { revoteTargets } from './day-resolution.service.js';

/**
 * POST /games/:gameId/votes (WW-901). The caller only ever sees their own
 * ballot. A later vote on the same ballot supersedes the earlier one.
 */
@Injectable()
export class VoteService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LobbyService) private readonly lobby: LobbyService,
  ) {}

  async cast(gameId: string, seat: GamePlayerRow, body: CastVoteRequest): Promise<CastVoteResponse> {
    return this.db.transaction(async (tx) => {
      const { game, you } = await this.lobby.lock(tx, gameId, seat.id);
      const ballot = game.phase === 'VOTING' ? 1 : game.phase === 'REVOTE' ? 2 : null;
      if (game.status !== 'ACTIVE' || ballot === null) throw errors.phaseConflict();
      const config = parseGameConfiguration(game.configSnapshot);

      if (you.lifeStatus !== 'ALIVE' && !config.voting.deadMayVote) throw errors.voteIneligible();
      if (body.targetPlayerId === null && !config.voting.abstain) throw errors.voteIneligible();
      if (body.targetPlayerId !== null) {
        const [target] = await tx.select().from(gamePlayers).where(eq(gamePlayers.id, body.targetPlayerId));
        if (!target || target.gameId !== game.id || target.lifeStatus !== 'ALIVE') throw errors.voteIneligible();
        if (ballot === 2 && !(await revoteTargets(tx, game, config)).has(body.targetPlayerId)) throw errors.voteIneligible();
      }

      const [previous] = await tx
        .select()
        .from(votes)
        .where(
          and(
            eq(votes.gameId, game.id),
            eq(votes.roundNumber, game.roundNumber),
            eq(votes.ballot, ballot),
            eq(votes.voterPlayerId, you.id),
            eq(votes.superseded, false),
          ),
        );
      if (previous && !config.voting.changeUntilClose) throw errors.phaseConflict();
      if (previous) await tx.update(votes).set({ superseded: true }).where(eq(votes.id, previous.id));

      const [row] = await tx
        .insert(votes)
        .values({
          gameId: game.id,
          roundNumber: game.roundNumber,
          ballot,
          voterPlayerId: you.id,
          targetPlayerId: body.targetPlayerId,
        })
        .returning();
      if (!row) throw errors.phaseConflict();
      return castVoteResponseSchema.parse({ ballot, targetPlayerId: row.targetPlayerId, supersedes: previous?.id ?? null });
    });
  }
}

import { Body, Controller, Get, HttpCode, Inject, Injectable, Logger, Param, Post, UseGuards } from '@nestjs/common';
import { killTargetViewSchema, setKillTargetRequestSchema, type KillTargetView } from '@warewolf/contracts';
import { hostDecisionProblem, packKillCandidates, type HostKillDecision } from '@warewolf/domain';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import { DATABASE, type Database, type Transaction } from '../db/database.js';
import { games, nightKillDecisions, type GamePlayerRow, type GameRow } from '../db/schema.js';
import { errors, UuidParam, ZodBody } from '../http/api-error.js';
import { LobbyService } from '../lobby/lobby.service.js';
import { loadNightInput } from './night-input.js';

/** Phases in which the host may read tonight's candidates: host confirm, and the reaction window after it. */
const READABLE = new Set<GameRow['phase']>(['NIGHT_HOST_CONFIRM', 'NIGHT_REACTION']);

/**
 * GET and POST /games/:gameId/host/kill-target (WW-803, OD-01). The host
 * picks the night's final target among the players the pack named, or no
 * kill. Host confirm cannot close until a choice exists (PhaseService). The
 * resolver reads the choice as `hostDecision`.
 *
 * Host only, under the game lock like every other write. The view names
 * which wolf named whom, which only the host may know.
 */
@Injectable()
export class KillTargetService {
  private readonly logger = new Logger('KillTarget');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LobbyService) private readonly lobby: LobbyService,
  ) {}

  async view(gameId: string, seat: GamePlayerRow): Promise<KillTargetView> {
    return this.db.transaction(async (tx) => {
      const { game, you } = await this.lobby.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'ACTIVE' || !READABLE.has(game.phase)) throw errors.phaseConflict();
      return this.build(tx, game);
    });
  }

  async choose(gameId: string, seat: GamePlayerRow, body: z.output<typeof setKillTargetRequestSchema>): Promise<KillTargetView> {
    return this.db.transaction(async (tx) => {
      const { game, you } = await this.lobby.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'ACTIVE' || game.phase !== 'NIGHT_HOST_CONFIRM') throw errors.phaseConflict();

      const decision: HostKillDecision = 'noKill' in body ? { kind: 'NO_KILL' } : { kind: 'TARGET', playerId: body.targetPlayerId };
      const input = await loadNightInput(tx, game);
      if (hostDecisionProblem(decision, packKillCandidates(input))) throw errors.killTargetNotSubmitted();

      const row = { targetPlayerId: decision.kind === 'TARGET' ? decision.playerId : null, noKill: decision.kind === 'NO_KILL' };
      await tx
        .insert(nightKillDecisions)
        .values({ gameId: game.id, roundNumber: game.roundNumber, ...row })
        .onConflictDoUpdate({ target: [nightKillDecisions.gameId, nightKillDecisions.roundNumber], set: { ...row, updatedAt: new Date() } });
      // Ids only at info level (data-model.md, section 6).
      this.logger.log(`kill-target game=${game.id} round=${game.roundNumber} decision=${decision.kind}`);
      const [locked] = await tx.select().from(games).where(eq(games.id, game.id));
      return this.build(tx, locked!);
    });
  }

  private async build(tx: Transaction, game: GameRow): Promise<KillTargetView> {
    const input = await loadNightInput(tx, game);
    return killTargetViewSchema.parse({
      gameId: game.id,
      phase: game.phase,
      roundNumber: game.roundNumber,
      candidates: packKillCandidates(input),
      decision: input.hostDecision,
      editable: game.phase === 'NIGHT_HOST_CONFIRM',
    });
  }
}

@Controller('games/:gameId/host/kill-target')
@UseGuards(SeatGuard)
export class KillTargetController {
  constructor(@Inject(KillTargetService) private readonly killTargets: KillTargetService) {}

  @Get()
  view(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<KillTargetView> {
    return this.killTargets.view(gameId, seat);
  }

  @Post()
  @HttpCode(200)
  choose(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(setKillTargetRequestSchema)) body: z.output<typeof setKillTargetRequestSchema>,
  ): Promise<KillTargetView> {
    return this.killTargets.choose(gameId, seat, body);
  }
}

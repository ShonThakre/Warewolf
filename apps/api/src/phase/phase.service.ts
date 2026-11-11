import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { gameStateSchema, parseGameConfiguration, type GameState, type PhaseClose } from '@warewolf/contracts';
import {
  canTransition,
  isActionWindow,
  isClosable,
  phaseDeadline,
  phaseRules,
  planClose,
  positionAfter,
  type CloseResult,
  type CloseStep,
  type PhaseRules,
} from '@warewolf/domain';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { DATABASE, type Database, type Transaction } from '../db/database.js';
import { gamePlayers, games, nightActions, type GamePlayerRow, type GameRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { EventService } from '../events/event.service.js';
import { LobbyService } from '../lobby/lobby.service.js';
import { hostDecisionFor } from '../night/night-input.js';
import { PHASE_RESOLVERS, type PhaseResolvers } from './resolution.js';
import { PHASE_CLOCK, PHASE_SCHEDULER, type Clock, type PhaseScheduler } from './timing.js';

/** How long a timed close waits before trying again after an error, such as a lost database connection. */
export const TIMED_CLOSE_RETRY_MS = 5_000;

type TimedClose =
  | { readonly kind: 'IDLE' }
  | { readonly kind: 'EARLY'; readonly at: Date }
  | { readonly kind: 'CLOSED'; readonly game: GameRow; readonly nightRound: number | null };

function describeClose(step: CloseStep): PhaseClose {
  switch (step.kind) {
    case 'ADVANCE':
      return { next: step.to, resolves: null };
    case 'RESOLVE_NIGHT':
      return { next: null, resolves: 'NIGHT' };
    case 'RESOLVE_DAY':
      return { next: null, resolves: 'DAY' };
  }
}

/**
 * The phase machine's adapter (WW-501 to WW-503). Every phase change after
 * start goes through `closeLocked`: one transaction, under the game row lock,
 * guarded by `state_version`. The pure rules in `@warewolf/domain` decide
 * where the game goes; this service runs the resolution a close needs,
 * writes the new phase and its deadline, and keeps the deadline timer in step.
 *
 * Two ways to close a phase:
 * - The host, with the `stateVersion` their screen shows. A stale version is a 409.
 * - The timer, once `phase_ends_at` has passed. It needs no version: an
 *   expired deadline always belongs to the current phase, because every close
 *   writes a new deadline or none.
 *
 * Boot recovery (data-model.md, section 5, OD-57): timed games whose deadline
 * passed while the process was down close as soon as it starts. Host-paced
 * games have no deadline and wait for the host.
 */
@Injectable()
export class PhaseService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Phase');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LobbyService) private readonly lobby: LobbyService,
    @Inject(PHASE_CLOCK) private readonly clock: Clock,
    @Inject(PHASE_SCHEDULER) private readonly scheduler: PhaseScheduler,
    @Inject(PHASE_RESOLVERS) private readonly resolvers: PhaseResolvers,
    @Inject(EventService) private readonly events: EventService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.recover();
  }

  /**
   * Republishes any night whose events were not written after commit, then
   * schedules every open deadline. Past ones run straight away.
   */
  async recover(): Promise<number> {
    try {
      await this.events.republishNights();
    } catch (error) {
      this.logger.error(`night event recovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const open = await this.db
      .select({ id: games.id, phaseEndsAt: games.phaseEndsAt })
      .from(games)
      .where(and(eq(games.status, 'ACTIVE'), isNotNull(games.phaseEndsAt)));
    for (const game of open) this.arm(game.id, game.phaseEndsAt!);
    if (open.length > 0) this.logger.log(`recovered deadlines=${open.length}`);
    return open.length;
  }

  /** GET /games/:gameId/state. Public facts and the caller's own seat. */
  async state(gameId: string, seat: GamePlayerRow): Promise<GameState> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    const seats = await this.db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)).orderBy(asc(gamePlayers.seatNumber));
    const you = seats.find((s) => s.id === seat.id);
    if (!you) throw errors.notFound();

    const config = parseGameConfiguration(game.configSnapshot ?? game.configDraft);
    const close = isClosable(game.phase) ? describeClose(planClose(game.phase, phaseRules(config))) : null;

    // Parsed through the contract so nothing it does not name can leave.
    return gameStateSchema.parse({
      gameId: game.id,
      status: game.status,
      phase: game.phase,
      roundNumber: game.roundNumber,
      stateVersion: game.stateVersion,
      pacing: config.pacing,
      phaseStartedAt: game.phaseStartedAt.toISOString(),
      phaseEndsAt: game.phaseEndsAt?.toISOString() ?? null,
      serverNow: this.clock.now().toISOString(),
      close,
      players: seats.map((s) => ({
        playerId: s.id,
        displayName: s.displayName,
        seatNumber: s.seatNumber,
        avatarId: s.avatarId,
        isHost: s.isHost,
        lifeStatus: s.lifeStatus,
      })),
      you: { playerId: you.id, isHost: you.isHost, lifeStatus: you.lifeStatus },
    });
  }

  /**
   * POST /games/:gameId/host/phase/close. Checked in this order: the caller
   * is the host (403 NOT_HOST), the phase can close (409 PHASE_CONFLICT), and
   * the version is the current one (409 PHASE_CONFLICT).
   */
  async close(gameId: string, seat: GamePlayerRow, stateVersion: number): Promise<GameState> {
    const closed = await this.db.transaction(async (tx) => {
      const { game, you } = await this.lobby.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'ACTIVE' || !isClosable(game.phase)) throw errors.phaseConflict();
      if (game.stateVersion !== stateVersion) throw errors.phaseConflict();
      return this.closeLocked(tx, game, 'HOST');
    });
    this.track(closed.game);
    await this.publishNight(closed.game.id, closed.nightRound);
    return this.state(gameId, seat);
  }

  /** The timer's close. Does nothing unless the game is active and its deadline has passed. */
  async closeExpired(gameId: string): Promise<void> {
    let outcome: TimedClose;
    try {
      outcome = await this.db.transaction(async (tx): Promise<TimedClose> => {
        const [game] = await tx.select().from(games).where(eq(games.id, gameId)).for('update');
        if (!game || game.status !== 'ACTIVE' || !game.phaseEndsAt || !isClosable(game.phase)) return { kind: 'IDLE' };
        if (game.phaseEndsAt.getTime() > this.clock.now().getTime()) return { kind: 'EARLY', at: game.phaseEndsAt };
        return { kind: 'CLOSED', ...(await this.closeLocked(tx, game, 'TIMER')) };
      });
    } catch (error) {
      this.logger.error(`timed close failed game=${gameId}: ${error instanceof Error ? error.message : String(error)}`);
      this.arm(gameId, new Date(this.clock.now().getTime() + TIMED_CLOSE_RETRY_MS));
      return;
    }
    if (outcome.kind === 'EARLY') this.arm(gameId, outcome.at);
    if (outcome.kind === 'CLOSED') {
      this.track(outcome.game);
      await this.publishNight(outcome.game.id, outcome.nightRound);
    }
  }

  /**
   * Closes the locked game's current phase: runs the resolution the close
   * needs, then writes the next phase, round, and deadline with the version
   * guard. The caller has already checked who may close and when.
   */
  private async closeLocked(tx: Transaction, game: GameRow, by: 'HOST' | 'TIMER'): Promise<{ game: GameRow; nightRound: number | null }> {
    if (!isClosable(game.phase)) throw errors.phaseConflict();
    // OD-01: host confirm ends only with a chosen target or an explicit "no kill" (WW-803).
    if (game.phase === 'NIGHT_HOST_CONFIRM' && !(await hostDecisionFor(tx, game.id, game.roundNumber))) throw errors.killTargetRequired();
    const rules: PhaseRules = phaseRules(parseGameConfiguration(game.configSnapshot));
    // Closing a submission window locks its choices (WW-601) before any resolution reads them.
    if (isActionWindow(game.phase)) {
      await tx
        .update(nightActions)
        .set({ status: 'LOCKED' })
        .where(
          and(
            eq(nightActions.gameId, game.id),
            eq(nightActions.roundNumber, game.roundNumber),
            eq(nightActions.phase, game.phase),
            eq(nightActions.status, 'PENDING'),
          ),
        );
    }
    const step = planClose(game.phase, rules);
    const nightRound = step.kind === 'RESOLVE_NIGHT' ? game.roundNumber : null;
    const result = await this.resolve(tx, game, step);
    const next = positionAfter(game, result);
    // The machine only produces listed transitions. Reaching this is a bug, not a client error.
    if (!canTransition(game.phase, next.phase)) throw new Error(`Illegal transition ${game.phase} -> ${next.phase}`);

    const now = this.clock.now();
    const [updated] = await tx
      .update(games)
      .set({
        status: next.status,
        phase: next.phase,
        roundNumber: next.roundNumber,
        phaseStartedAt: now,
        phaseEndsAt: next.status === 'ACTIVE' ? phaseDeadline(next.phase, rules, now) : null,
        stateVersion: sql`${games.stateVersion} + 1`,
        updatedAt: now,
      })
      .where(and(eq(games.id, game.id), eq(games.stateVersion, game.stateVersion)))
      .returning();
    if (!updated) throw errors.phaseConflict();

    this.logger.log(`phase game=${game.id} round=${updated.roundNumber} ${game.phase}->${updated.phase} by=${by}`);
    return { game: updated, nightRound };
  }

  /** Events are written after the night commit. A failure here does not roll the night back. */
  private async publishNight(gameId: string, round: number | null): Promise<void> {
    if (round === null) return;
    try {
      await this.events.publishNight(gameId, round);
    } catch (error) {
      this.logger.error(`night events failed game=${gameId} round=${round}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async resolve(tx: Transaction, game: GameRow, step: CloseStep): Promise<CloseResult> {
    switch (step.kind) {
      case 'ADVANCE':
        return step;
      case 'RESOLVE_NIGHT': {
        const night = await this.resolvers.resolveNight(tx, game);
        return { kind: 'RESOLVE_NIGHT', gameOver: night.gameOver };
      }
      case 'RESOLVE_DAY': {
        const day = await this.resolvers.resolveDay(tx, game, step.ballot);
        return { kind: 'RESOLVE_DAY', ballot: step.ballot, gameOver: day.gameOver, tied: day.tied };
      }
    }
  }

  /** Keeps the timer in step with a committed phase: schedule its deadline, or drop any old one. */
  private track(game: GameRow): void {
    if (game.status === 'ACTIVE' && game.phaseEndsAt) this.arm(game.id, game.phaseEndsAt);
    else this.scheduler.cancel(game.id);
  }

  private arm(gameId: string, at: Date): void {
    this.scheduler.schedule(gameId, at, () => this.closeExpired(gameId));
  }
}

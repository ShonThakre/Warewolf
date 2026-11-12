import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  myActionsSchema,
  submitActionResponseSchema,
  type MyActions,
  type SubmitActionResponse,
  type submitActionRequestSchema,
} from '@warewolf/contracts';
import { availability, checkSubmission, exclusiveSiblings, finalWolfTarget, type LifeStatus, type SubmissionRefusal, type TargetProblem } from '@warewolf/domain';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { DATABASE, isUniqueViolation, type Database } from '../db/database.js';
import { abilityInstances, gamePlayers, games, idempotencyKeys, nightActions, type GamePlayerRow, type NightActionRow } from '../db/schema.js';
import { ApiError, errors, type FieldIssue } from '../http/api-error.js';
import { latestUnpublished } from '../day/publications.js';
import { LobbyService } from '../lobby/lobby.service.js';
import { loadNightInput } from '../night/night-input.js';

/** What the client sends after the contract has parsed it, defaults applied. */
export type ParsedSubmission = z.output<typeof submitActionRequestSchema>;

const TARGET_MESSAGES: Readonly<Record<TargetProblem, FieldIssue>> = {
  TARGET_COUNT: { path: 'targetPlayerIds', message: 'Choose the number of players this ability takes.' },
  TARGET_DUPLICATE: { path: 'targetPlayerIds', message: 'Choose different players.' },
  TARGET_UNKNOWN: { path: 'targetPlayerIds', message: 'That player is not in this game.' },
  TARGET_LIFE: { path: 'targetPlayerIds', message: 'That player cannot be chosen for this ability.' },
  TARGET_SELF: { path: 'targetPlayerIds', message: 'This ability cannot target you.' },
  TARGET_REPEAT: { path: 'targetPlayerIds', message: 'You chose that player last night. Choose someone else.' },
  PAYLOAD: { path: 'payload', message: 'This ability does not take that choice.' },
  TEXT_LENGTH: { path: 'payload', message: 'Write a hint of 1 to 140 characters.' },
  TEXT_NAMES_PLAYER: { path: 'payload', message: 'The hint cannot name a player or a seat.' },
};

function refusalError(refusal: Exclude<SubmissionRefusal, 'ACTION_TARGET_ILLEGAL'>): ApiError {
  switch (refusal) {
    case 'NOT_FOUND':
      return errors.notFound();
    case 'ACTION_NOT_YOUR_ABILITY':
      return errors.actionNotYourAbility();
    case 'ACTION_DEAD':
      return errors.actionDead();
    case 'ACTION_WRONG_PHASE':
      return errors.actionWrongPhase();
    case 'ACTION_NO_CHARGES':
      return errors.actionNoCharges();
  }
}

/** The response for an action row. Only the caller's own choice; never an outcome. */
function view(row: NightActionRow): SubmitActionResponse {
  return submitActionResponseSchema.parse({
    actionId: row.id,
    status: row.status,
    abilityInstanceId: row.abilityInstanceId,
    roundNumber: row.roundNumber,
    phase: row.phase,
    targetPlayerIds: row.targetPlayerIds,
    payload: row.payload,
  });
}

/** SHA-256 of the request, with payload keys sorted so key order does not change it. */
export function requestHash(body: ParsedSubmission): string {
  const canonical = JSON.stringify({
    route: 'POST /actions',
    abilityInstanceId: body.abilityInstanceId,
    targetPlayerIds: body.targetPlayerIds,
    payload: Object.fromEntries(Object.entries(body.payload).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * POST /games/:gameId/actions and GET /games/:gameId/me/actions (WW-601).
 *
 * One route for every capability: the pure `checkSubmission` decides, from
 * the ability's definition and never from its role id. A submission runs
 * under the game row lock, so it cannot interleave with a phase close: once
 * the window closes, its actions are LOCKED and a late submission is
 * ACTION_WRONG_PHASE.
 *
 * Idempotency: the same `Idempotency-Key` and body replays the stored
 * response, even after the phase has moved on. The same key with another
 * body is IDEMPOTENCY_CONFLICT. Only successes are stored, so a refused
 * request can be retried with the same key.
 */
@Injectable()
export class ActionService {
  private readonly logger = new Logger('Action');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LobbyService) private readonly lobby: LobbyService,
  ) {}

  async submit(gameId: string, seat: GamePlayerRow, key: string, body: ParsedSubmission): Promise<SubmitActionResponse> {
    const hash = requestHash(body);
    try {
      return await this.db.transaction(async (tx) => {
        const { game, you } = await this.lobby.lock(tx, gameId, seat.id);

        const [stored] = await tx
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.gameId, game.id), eq(idempotencyKeys.playerId, you.id), eq(idempotencyKeys.key, key)));
        if (stored) {
          if (stored.requestHash !== hash) throw errors.idempotencyConflict();
          return submitActionResponseSchema.parse(stored.response);
        }

        const [ability] = await tx
          .select()
          .from(abilityInstances)
          .where(and(eq(abilityInstances.id, body.abilityInstanceId), eq(abilityInstances.gameId, game.id)));
        // Someone else's ability is indistinguishable from no ability.
        if (!ability || ability.playerId !== you.id) throw errors.notFound();

        const seats = await tx
          .select({ id: gamePlayers.id, lifeStatus: gamePlayers.lifeStatus, displayName: gamePlayers.displayName, diedRound: gamePlayers.diedRound })
          .from(gamePlayers)
          .where(eq(gamePlayers.gameId, game.id));
        const check = checkSubmission({
          status: game.status,
          phase: game.phase,
          round: game.roundNumber,
          actorLife: you.lifeStatus,
          actorDiedRound: you.diedRound,
          actorId: you.id,
          ability,
          players: new Map<string, LifeStatus>(seats.map((s) => [s.id, s.lifeStatus])),
          displayNames: new Map(seats.map((s) => [s.id, s.displayName])),
          targetPlayerIds: body.targetPlayerIds,
          payload: body.payload,
        });
        if (!check.ok) {
          if (check.refusal === 'ACTION_TARGET_ILLEGAL') throw errors.actionTargetIllegal([TARGET_MESSAGES[check.reason as TargetProblem]]);
          throw refusalError(check.refusal);
        }
        // GAP-01: a Seeker can only publish a result they hold and have not published.
        if (ability.config.capability === 'ROLE_REVEAL' && !(await latestUnpublished(tx, game.id, you.id))) {
          throw errors.actionTargetIllegal([{ path: 'targetPlayerIds', message: 'You have no result to publish yet.' }]);
        }

        // A new choice replaces the pending one. The old row stays, cancelled, as the record.
        const mine = await tx.select().from(abilityInstances).where(eq(abilityInstances.playerId, you.id));
        const siblingIds = exclusiveSiblings(mine, ability).map((row) => row.id);
        await tx
          .update(nightActions)
          .set({ status: 'CANCELLED' })
          .where(
            and(
              eq(nightActions.gameId, game.id),
              eq(nightActions.roundNumber, game.roundNumber),
              eq(nightActions.status, 'PENDING'),
              siblingIds.length > 0 ? inArray(nightActions.abilityInstanceId, [ability.id, ...siblingIds]) : eq(nightActions.abilityInstanceId, ability.id),
            ),
          );
        const [row] = await tx
          .insert(nightActions)
          .values({
            gameId: game.id,
            roundNumber: game.roundNumber,
            phase: check.window,
            playerId: you.id,
            abilityInstanceId: ability.id,
            targetPlayerIds: [...body.targetPlayerIds],
            payload: body.payload,
            idempotencyKey: key,
          })
          .returning();
        const response = view(row!);
        await tx.insert(idempotencyKeys).values({ gameId: game.id, playerId: you.id, key, requestHash: hash, response });

        // Ids only: the ability id would name the role (data-model.md, section 6).
        this.logger.log(`action game=${game.id} round=${game.roundNumber} player=${you.id} action=${row!.id}`);
        return response;
      });
    } catch (error) {
      // A locked action for this ability and round already exists. The lock makes this unreachable in practice.
      if (isUniqueViolation(error, 'night_actions_open_uq')) throw errors.actionDuplicate();
      throw error;
    }
  }

  /** The caller's abilities, whether each is open now, and their pending or locked choice this round. */
  async mine(gameId: string, seat: GamePlayerRow): Promise<MyActions> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    const [you] = await this.db.select().from(gamePlayers).where(eq(gamePlayers.id, seat.id));
    if (!game || !you || you.gameId !== gameId) throw errors.notFound();

    const [abilities, actions] = await Promise.all([
      this.db.select().from(abilityInstances).where(eq(abilityInstances.playerId, you.id)).orderBy(asc(abilityInstances.createdAt), asc(abilityInstances.abilityId)),
      this.db
        .select()
        .from(nightActions)
        .where(
          and(
            eq(nightActions.playerId, you.id),
            eq(nightActions.roundNumber, game.roundNumber),
            inArray(nightActions.status, ['PENDING', 'LOCKED']),
          ),
        ),
    ]);

    const rows = abilities.map((ability) => ({
      ability,
      open: availability(ability, { status: game.status, phase: game.phase, round: game.roundNumber, actorLife: you.lifeStatus, actorDiedRound: you.diedRound }),
    }));
    // OD-02: the informed Doctor is told tonight's final target, only while their save is open in the
    // reaction window. Computed by the resolver from the locked submissions and the host's choice.
    const informed = rows.some(({ ability, open }) => open === 'OPEN' && ability.config.target.kind === 'FINAL_WOLF_TARGET');
    const target = informed ? finalWolfTarget(await loadNightInput(this.db, game)) : undefined;

    return myActionsSchema.parse({
      gameId: game.id,
      phase: game.phase,
      roundNumber: game.roundNumber,
      abilities: rows.map(({ ability, open }) => {
        const action = actions.find((a) => a.abilityInstanceId === ability.id);
        return {
          abilityInstanceId: ability.id,
          abilityId: ability.abilityId,
          availability: open,
          action: action ? view(action) : null,
          ...(open === 'OPEN' && ability.config.target.kind === 'FINAL_WOLF_TARGET' ? { finalWolfTarget: target } : {}),
        };
      }),
    });
  }
}

import { randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  AVATAR_COUNT,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  parseGameConfiguration,
  type LobbyProjection,
  type SeatCredentials,
} from '@warewolf/contracts';
import {
  DEFAULT_PACK_BY_MODE,
  getPack,
  validateConfiguration,
  type GameConfiguration,
  type GameMode,
  type ValidationResult,
} from '@warewolf/domain';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { hashToken, newSeatToken } from '../auth/seat.js';
import { DATABASE, isUniqueViolation, type Database, type Transaction } from '../db/database.js';
import { gamePlayers, games, type GamePlayerRow, type GameRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';
import { PlayGateway } from '../realtime/play.gateway.js';

/** A 6-character code from the unambiguous alphabet. `pick` is injectable for tests. */
export function generateRoomCode(pick: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[pick(ROOM_CODE_ALPHABET.length)];
  return code;
}

const ROOM_CODE_ATTEMPTS = 8;

export function startState(status: GameRow['status'], seats: number, draft: GameConfiguration, validation: ValidationResult) {
  const blockers: LobbyProjection['start']['blockers'] = [];
  if (status !== 'LOBBY') blockers.push('NOT_LOBBY');
  if (seats < draft.playerCount) blockers.push('SEATS_OPEN');
  if (seats > draft.playerCount) blockers.push('SEATS_OVER');
  if (!validation.valid) blockers.push('CONFIG_INVALID');
  return { ready: blockers.length === 0, blockers, requiresWarningAcknowledgement: validation.warnings.length > 0 };
}

/** Lowest number from 1 not in use, so a seat or avatar freed by a leave is reused. */
function lowestFree(taken: readonly number[]): number {
  const used = new Set(taken);
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/**
 * The avatar a joining player gets: the one they asked for if nobody has it,
 * otherwise the lowest free one. A room never holds more than 30 players, so
 * one of the 36 avatars is always free.
 */
function chooseAvatar(taken: readonly number[], requested: number | undefined): number {
  if (requested === undefined) return lowestFree(taken);
  if (taken.includes(requested)) throw errors.avatarTaken();
  return requested;
}

@Injectable()
export class LobbyService {
  private readonly logger = new Logger('Lobby');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Optional() @Inject(PlayGateway) private readonly play?: PlayGateway,
  ) {}

  /** POST /games. Creates the room and the host seat in one transaction. */
  async create(displayName: string, mode: GameMode, avatarId?: number): Promise<SeatCredentials> {
    const pack = getPack(DEFAULT_PACK_BY_MODE[mode]);
    if (!pack) throw new Error(`No default pack for ${mode}`);
    const token = newSeatToken();

    for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt++) {
      const ids = { gameId: randomUUID(), playerId: randomUUID(), roomCode: generateRoomCode() };
      try {
        await this.db.transaction(async (tx) => {
          await tx.insert(games).values({
            id: ids.gameId,
            roomCode: ids.roomCode,
            hostPlayerId: ids.playerId,
            mode,
            configDraft: pack.config,
          });
          await tx.insert(gamePlayers).values({
            id: ids.playerId,
            gameId: ids.gameId,
            displayName,
            seatNumber: 1,
            avatarId: avatarId ?? 1,
            isHost: true,
            tokenHash: hashToken(token),
          });
        });
        return { ...ids, token, isHost: true };
      } catch (error) {
        if (isUniqueViolation(error, 'games_room_code_open_uq')) continue;
        throw error;
      }
    }
    throw new Error('Could not allocate a free room code');
  }

  /** POST /games/join */
  async join(roomCode: string, displayName: string, avatarId?: number): Promise<SeatCredentials> {
    const token = newSeatToken();
    try {
      return await this.db.transaction(async (tx) => {
        const [game] = await tx
          .select()
          .from(games)
          .where(and(eq(games.roomCode, roomCode), inArray(games.status, ['LOBBY', 'ACTIVE'])))
          .for('update');
        if (!game) throw errors.notFound();
        if (game.status !== 'LOBBY') throw errors.gameStarted();

        const seats = await tx.select().from(gamePlayers).where(eq(gamePlayers.gameId, game.id));
        if (seats.length >= this.draft(game).playerCount) throw errors.roomFull();
        const lower = displayName.toLowerCase();
        if (seats.some((s) => s.displayName.toLowerCase() === lower)) throw errors.nameTaken();

        const playerId = randomUUID();
        await tx.insert(gamePlayers).values({
          id: playerId,
          gameId: game.id,
          displayName,
          seatNumber: lowestFree(seats.map((s) => s.seatNumber)),
          avatarId: chooseAvatar(seats.map((s) => s.avatarId), avatarId),
          tokenHash: hashToken(token),
        });
        await this.bump(tx, game.id);
        return { gameId: game.id, roomCode: game.roomCode, playerId, token, isHost: false };
      });
    } catch (error) {
      // The checks above run under the game lock; these catch anything they missed.
      if (isUniqueViolation(error, 'game_players_name_uq')) throw errors.nameTaken();
      if (isUniqueViolation(error, 'game_players_avatar_uq')) throw errors.avatarTaken();
      throw error;
    }
  }

  /** PUT /games/:gameId/me/avatar. Lobby only. Choosing your current avatar changes nothing. */
  async changeAvatar(gameId: string, seat: GamePlayerRow, avatarId: number): Promise<LobbyProjection> {
    if (avatarId < 1 || avatarId > AVATAR_COUNT) throw errors.invalid([{ path: 'avatarId', message: `Choose an avatar from 1 to ${AVATAR_COUNT}.` }]);
    try {
      await this.db.transaction(async (tx) => {
        const { game, you } = await this.lock(tx, gameId, seat.id);
        if (game.status !== 'LOBBY') throw errors.gameStarted();
        if (you.avatarId === avatarId) return;
        const [holder] = await tx
          .select({ id: gamePlayers.id })
          .from(gamePlayers)
          .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.avatarId, avatarId)));
        if (holder) throw errors.avatarTaken();
        await tx.update(gamePlayers).set({ avatarId }).where(eq(gamePlayers.id, you.id));
        await this.bump(tx, game.id);
      });
    } catch (error) {
      if (isUniqueViolation(error, 'game_players_avatar_uq')) throw errors.avatarTaken();
      throw error;
    }
    return this.projection(gameId, seat.id);
  }

  /** GET /games/:gameId */
  async projection(gameId: string, playerId: string): Promise<LobbyProjection> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    const [you] = await this.db.select().from(gamePlayers).where(eq(gamePlayers.id, playerId));
    if (!game || !you || you.gameId !== gameId) throw errors.notFound();
    const seats = await this.db.select().from(gamePlayers).where(eq(gamePlayers.gameId, gameId)).orderBy(asc(gamePlayers.seatNumber));
    return this.project(game, seats, you);
  }

  /** POST /games/:gameId/leave. A host leaving without naming a successor cancels the room. */
  async leave(gameId: string, seat: GamePlayerRow, hostPlayerId?: string): Promise<{ gameCancelled: boolean }> {
    return this.db.transaction(async (tx) => {
      const { game, you } = await this.lock(tx, gameId, seat.id);
      if (game.status !== 'LOBBY') throw errors.gameStarted();

      if (you.isHost && !hostPlayerId) {
        await this.cancelLocked(tx, game.id, 'HOST');
        return { gameCancelled: true };
      }
      if (you.isHost && hostPlayerId) {
        await this.transferLocked(tx, game.id, you, hostPlayerId, 'hostPlayerId');
      }
      await tx.delete(gamePlayers).where(eq(gamePlayers.id, you.id));
      await this.bump(tx, game.id);
      return { gameCancelled: false, movedHost: you.isHost && hostPlayerId ? hostPlayerId : null };
    }).then(({ movedHost, ...result }) => {
      if (movedHost) this.play?.moveHost(gameId, seat.id, movedHost);
      return result;
    });
  }

  /** POST /games/:gameId/players/:playerId/kick. Lobby only. The kicked player may rejoin (OD-65). */
  async kick(gameId: string, seat: GamePlayerRow, playerId: string): Promise<LobbyProjection> {
    await this.db.transaction(async (tx) => {
      const { game, you } = await this.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'LOBBY') throw errors.gameStarted();
      if (playerId === you.id) throw errors.invalid([{ path: 'playerId', message: 'The host cannot remove their own seat. Use leave instead.' }]);
      const removed = await tx
        .delete(gamePlayers)
        .where(and(eq(gamePlayers.id, playerId), eq(gamePlayers.gameId, game.id)))
        .returning({ id: gamePlayers.id });
      if (removed.length === 0) throw errors.notFound();
      await this.bump(tx, game.id);
    });
    return this.projection(gameId, seat.id);
  }

  /** POST /games/:gameId/host/transfer. Lobby or active. */
  async transfer(gameId: string, seat: GamePlayerRow, playerId: string): Promise<LobbyProjection> {
    await this.db.transaction(async (tx) => {
      const { game, you } = await this.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'LOBBY' && game.status !== 'ACTIVE') throw errors.phaseConflict();
      await this.transferLocked(tx, game.id, you, playerId, 'playerId');
      await this.bump(tx, game.id);
    });
    // After commit: the old host's live sockets leave the host room and the new host's join it (WW-1303).
    this.play?.moveHost(gameId, seat.id, playerId);
    return this.projection(gameId, seat.id);
  }

  /** POST /games/:gameId/host/cancel */
  async cancel(gameId: string, seat: GamePlayerRow): Promise<LobbyProjection> {
    await this.db.transaction(async (tx) => {
      const { game, you } = await this.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'LOBBY' && game.status !== 'ACTIVE') throw errors.phaseConflict();
      await this.cancelLocked(tx, game.id, 'HOST');
    });
    return this.projection(gameId, seat.id);
  }

  /** Locks the game row and re-reads the caller's seat inside the transaction. */
  async lock(tx: Transaction, gameId: string, playerId: string): Promise<{ game: GameRow; you: GamePlayerRow }> {
    const [game] = await tx.select().from(games).where(eq(games.id, gameId)).for('update');
    const [you] = await tx.select().from(gamePlayers).where(eq(gamePlayers.id, playerId));
    if (!game || !you || you.gameId !== gameId) throw errors.notFound();
    return { game, you };
  }

  /** Increments `state_version`, which every committed lobby change must do. */
  async bump(tx: Transaction, gameId: string): Promise<void> {
    await tx
      .update(games)
      .set({ stateVersion: sql`${games.stateVersion} + 1`, updatedAt: new Date() })
      .where(eq(games.id, gameId));
  }

  draft(game: GameRow): GameConfiguration {
    return parseGameConfiguration(game.configDraft);
  }

  private async transferLocked(tx: Transaction, gameId: string, from: GamePlayerRow, toId: string, field: string): Promise<void> {
    if (toId === from.id) throw errors.invalid([{ path: field, message: 'Choose another player.' }]);
    const [to] = await tx.select().from(gamePlayers).where(and(eq(gamePlayers.id, toId), eq(gamePlayers.gameId, gameId)));
    if (!to) throw errors.invalid([{ path: field, message: 'That player is not in this game.' }]);
    // Clear the old host first: at most one seat per game may be host at any moment.
    await tx.update(gamePlayers).set({ isHost: false }).where(eq(gamePlayers.id, from.id));
    await tx.update(gamePlayers).set({ isHost: true }).where(eq(gamePlayers.id, to.id));
    await tx.update(games).set({ hostPlayerId: to.id }).where(eq(games.id, gameId));
    this.logger.log(`host transfer game=${gameId} from=${from.id} to=${to.id}`);
  }

  private async cancelLocked(tx: Transaction, gameId: string, reason: 'HOST' | 'SURRENDER'): Promise<void> {
    await tx
      .update(games)
      .set({ status: 'CANCELLED', phase: 'CANCELLED', cancelReason: reason, phaseStartedAt: new Date(), phaseEndsAt: null })
      .where(eq(games.id, gameId));
    await this.bump(tx, gameId);
    this.logger.log(`cancelled game=${gameId} reason=${reason}`);
  }

  private project(game: GameRow, seats: readonly GamePlayerRow[], you: GamePlayerRow): LobbyProjection {
    const draft = this.draft(game);
    const validation = validateConfiguration(draft);
    return {
      gameId: game.id,
      roomCode: game.roomCode,
      status: game.status,
      phase: game.phase,
      mode: game.mode,
      rolePackId: draft.rolePackId,
      playerCount: draft.playerCount,
      hostPlayerId: game.hostPlayerId,
      stateVersion: game.stateVersion,
      players: seats.map((s) => ({
        playerId: s.id,
        displayName: s.displayName,
        seatNumber: s.seatNumber,
        avatarId: s.avatarId,
        isHost: s.isHost,
        connectionStatus: s.connectionStatus,
      })),
      you: { playerId: you.id, isHost: you.isHost },
      configuration: {
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        summary: validation.summary,
      },
      start: startState(game.status, seats.length, draft, validation),
    };
  }
}

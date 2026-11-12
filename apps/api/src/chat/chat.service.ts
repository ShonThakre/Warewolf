import { Inject, Injectable, Logger } from '@nestjs/common';
import { chatMessageSchema, chatViewSchema, type ChatMessage, type ChatView } from '@warewolf/contracts';
import { CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, chatRefusal, type ChatRefusal } from '@warewolf/domain';
import { and, asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { chatMessages, chatMutes, gamePlayers, games, type ChatMessageRow, type GamePlayerRow } from '../db/schema.js';
import { type ApiError, errors } from '../http/api-error.js';
import { logLine } from '../http/log-line.js';
import { SlidingWindow } from '../http/rate-limit.js';
import { PHASE_CLOCK, type Clock } from '../phase/timing.js';
import { PlayGateway } from '../realtime/play.gateway.js';

/**
 * Table chat (WW-1104). The rules are OD-72; `chatRefusal` in the domain
 * decides who may post. This service stores, reads, and moderates, and
 * emits each change to the game's public room after it commits.
 *
 * Every message is public. There is no recipient column and no other room,
 * so nothing here can open a wolf or dead channel.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger('Chat');
  /** Per seat. Each app has its own, so tests do not share a budget. */
  private readonly posts = new SlidingWindow(CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(PHASE_CLOCK) private readonly clock: Clock,
    @Inject(PlayGateway) private readonly play: PlayGateway,
  ) {}

  /** GET /games/:gameId/chat. Any seat in the game, alive or dead. */
  async view(gameId: string, seat: GamePlayerRow): Promise<ChatView> {
    const [game] = await this.db.select({ status: games.status, phase: games.phase }).from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    const rows = await this.db.select().from(chatMessages).where(eq(chatMessages.gameId, gameId)).orderBy(asc(chatMessages.seq));
    const muted = await this.db.select({ playerId: chatMutes.playerId }).from(chatMutes).where(eq(chatMutes.gameId, gameId)).orderBy(asc(chatMutes.createdAt));
    const mutedPlayerIds = muted.map((m) => m.playerId);
    const refusal = chatRefusal({ status: game.status, phase: game.phase, lifeStatus: seat.lifeStatus, muted: mutedPlayerIds.includes(seat.id) });
    return chatViewSchema.parse({
      messages: rows.map(toMessage),
      mutedPlayerIds,
      you: { canPost: refusal === null, refusal },
    });
  }

  /**
   * POST /games/:gameId/chat/messages. The body has already been trimmed and
   * length-checked by the contract (422). Then, in order: the seat's post
   * budget (429), and the OD-72 rules under a shared lock on the game row,
   * so a phase close cannot commit between the check and the insert.
   *
   * Every attempt that reaches this method counts against the budget,
   * including one that is refused, so a seat cannot probe the rules quickly.
   */
  async post(gameId: string, seat: GamePlayerRow, body: string): Promise<ChatMessage> {
    if (!this.posts.allow(seat.id, this.clock.now().getTime())) throw errors.rateLimited();

    const row = await this.db.transaction(async (tx) => {
      const [game] = await tx.select().from(games).where(eq(games.id, gameId)).for('share');
      const [you] = await tx.select().from(gamePlayers).where(eq(gamePlayers.id, seat.id));
      if (!game || !you || you.gameId !== gameId) throw errors.notFound();
      const [mute] = await tx
        .select({ playerId: chatMutes.playerId })
        .from(chatMutes)
        .where(and(eq(chatMutes.gameId, gameId), eq(chatMutes.playerId, you.id)));
      const refusal = chatRefusal({ status: game.status, phase: game.phase, lifeStatus: you.lifeStatus, muted: mute !== undefined });
      if (refusal) throw refusalError(refusal);

      const [inserted] = await tx
        .insert(chatMessages)
        .values({
          gameId,
          playerId: you.id,
          body,
          roundNumber: game.roundNumber,
          // chatRefusal returned null, so the phase is a chat phase.
          phase: game.phase as ChatMessageRow['phase'],
        })
        .returning();
      if (!inserted) throw errors.phaseConflict();
      return inserted;
    });

    const message = toMessage(row);
    this.play.emitPublic(gameId, 'CHAT_MESSAGE_POSTED', message);
    return message;
  }

  /** DELETE /games/:gameId/chat/messages/:messageId. Host only. */
  async remove(gameId: string, seat: GamePlayerRow, messageId: string): Promise<void> {
    if (!seat.isHost) throw errors.notHost();
    const [deleted] = await this.db
      .delete(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.gameId, gameId)))
      .returning({ seq: chatMessages.seq });
    if (!deleted) throw errors.notFound();
    this.logger.log(logLine('chat delete', { game: gameId, player: seat.id, seq: deleted.seq }));
    this.play.emitPublic(gameId, 'CHAT_MESSAGE_DELETED', { messageId });
  }

  /**
   * PUT (muted true) or DELETE (muted false) /games/:gameId/chat/mutes/:playerId.
   * Host only, while the game runs. Repeating a mute or an unmute changes
   * nothing and emits nothing.
   */
  async setMuted(gameId: string, seat: GamePlayerRow, playerId: string, muted: boolean): Promise<void> {
    if (!seat.isHost) throw errors.notHost();
    if (playerId === seat.id) throw errors.invalid([{ path: 'playerId', message: 'The host cannot mute their own seat.' }]);

    const changed = await this.db.transaction(async (tx) => {
      const [game] = await tx.select({ status: games.status }).from(games).where(eq(games.id, gameId)).for('share');
      if (!game) throw errors.notFound();
      const [target] = await tx
        .select({ id: gamePlayers.id })
        .from(gamePlayers)
        .where(and(eq(gamePlayers.id, playerId), eq(gamePlayers.gameId, gameId)));
      if (!target) throw errors.notFound();
      if (game.status !== 'ACTIVE') throw errors.phaseConflict();
      if (muted) {
        const rows = await tx.insert(chatMutes).values({ gameId, playerId }).onConflictDoNothing().returning({ playerId: chatMutes.playerId });
        return rows.length > 0;
      }
      const rows = await tx
        .delete(chatMutes)
        .where(and(eq(chatMutes.gameId, gameId), eq(chatMutes.playerId, playerId)))
        .returning({ playerId: chatMutes.playerId });
      return rows.length > 0;
    });

    if (!changed) return;
    this.logger.log(logLine(muted ? 'chat mute' : 'chat unmute', { game: gameId, player: seat.id, to: playerId }));
    this.play.emitPublic(gameId, muted ? 'CHAT_SEAT_MUTED' : 'CHAT_SEAT_UNMUTED', { playerId });
  }
}

function toMessage(row: ChatMessageRow): ChatMessage {
  return chatMessageSchema.parse({
    messageId: row.id,
    seq: row.seq,
    playerId: row.playerId,
    body: row.body,
    roundNumber: row.roundNumber,
    phase: row.phase,
    createdAt: row.createdAt.toISOString(),
  });
}

function refusalError(refusal: ChatRefusal): ApiError {
  switch (refusal) {
    case 'CLOSED':
      return errors.chatClosed();
    case 'DEAD':
      return errors.chatReadOnly();
    case 'MUTED':
      return errors.chatMuted();
  }
}

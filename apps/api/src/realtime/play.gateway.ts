import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { CHAT_SOCKET_EVENTS } from '@warewolf/contracts';
import { eq } from 'drizzle-orm';
import { Server, type Socket } from 'socket.io';
import { hashToken } from '../auth/seat.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers } from '../db/schema.js';
import { EventService, type StoredEvent } from '../events/event.service.js';

interface SeatAuth {
  readonly id: string;
  readonly gameId: string;
  readonly isHost: boolean;
}

/**
 * Socket.IO namespace `/play` (WW-1101). The handshake token is the seat
 * bearer token. `join-session` enters only that seat's rooms. A token from
 * another game is rejected, and a `playerId` in the payload is ignored.
 * Clients cannot emit game facts; those events are dropped.
 */
@Injectable()
export class PlayGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  io: Server | undefined = undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(EventService) private readonly events: EventService,
    private readonly adapterHost: HttpAdapterHost,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Emits each stored row to its audience room. A missing server is a no-op; reconnect reads the rows. */
  emitStored(events: readonly StoredEvent[]): void {
    const play = this.io?.of('/play');
    if (!play) return;
    for (const event of events) {
      const room = roomFor(event);
      if (room) play.to(room).emit(event.type, clientEvent(event));
    }
  }

  /**
   * The host changed (WW-1303). Rooms are joined when a socket connects, so
   * without this the old host's open sockets would keep receiving host-only
   * events and the new host would miss them until a reconnect. Call after the
   * transfer commits.
   */
  moveHost(gameId: string, fromPlayerId: string, toPlayerId: string): void {
    const play = this.io?.of('/play');
    if (!play) return;
    const hostRoom = `game:${gameId}:host`;
    play.in(`game:${gameId}:player:${fromPlayerId}`).socketsLeave(hostRoom);
    play.in(`game:${gameId}:player:${toPlayerId}`).socketsJoin(hostRoom);
  }

  /**
   * A live-only fact for every seat in the game, such as a chat message
   * (WW-1104). Not stored in `game_events`: a reconnecting client reads the
   * owning route again instead of replaying these.
   */
  emitPublic(gameId: string, type: string, payload: unknown): void {
    this.io?.of('/play').to(`game:${gameId}:public`).emit(type, payload);
  }

  onApplicationBootstrap(): void {
    if (this.io) return;
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    // Same origin only, unless CORS_ORIGINS lists the APK's WebView origin (WW-1602).
    const origin = this.config.corsOrigins.length > 0 ? [...this.config.corsOrigins] : false;
    this.io = new Server(httpServer, { cors: { origin } });
    const play = this.io.of('/play');
    play.use((socket, next) => {
      void this.authenticate(socket)
        .then((seat) => {
          if (!seat) {
            next(new Error('UNAUTHENTICATED'));
            return;
          }
          socket.data.seat = seat;
          next();
        })
        .catch(() => next(new Error('UNAUTHENTICATED')));
    });
    play.on('connection', (socket) => this.onConnection(socket));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.io?.close();
    this.io = undefined;
  }

  private async currentSeat(playerId: string): Promise<SeatAuth | null> {
    const [seat] = await this.db.select().from(gamePlayers).where(eq(gamePlayers.id, playerId)).limit(1);
    return seat ? { id: seat.id, gameId: seat.gameId, isHost: seat.isHost } : null;
  }

  private async authenticate(socket: Socket): Promise<SeatAuth | null> {
    const token = tokenOf(socket);
    if (!token) return null;
    const [seat] = await this.db.select().from(gamePlayers).where(eq(gamePlayers.tokenHash, hashToken(token))).limit(1);
    if (!seat) return null;
    return { id: seat.id, gameId: seat.gameId, isHost: seat.isHost };
  }

  private onConnection(socket: Socket): void {
    // Server-to-client only. A client-originated fact is not relayed.
    // Chat is posted over HTTP, where the OD-72 rules are checked; a socket-sent chat event is dropped too.
    for (const type of ['INFECTION_OCCURRED', 'ROLE_ASSIGNED', 'ROLE_CONVERTED', 'INVESTIGATION_RESULT', 'PLAYER_ELIMINATED', ...CHAT_SOCKET_EVENTS]) {
      socket.on(type, () => {});
    }
    socket.on('join-session', (body: unknown, ack?: (result: { ok: boolean }) => void) => {
      const seat = socket.data.seat as SeatAuth | undefined;
      const gameId = typeof body === 'object' && body !== null && 'gameId' in body && typeof body.gameId === 'string' ? body.gameId : '';
      const reply = (ok: boolean) => {
        if (typeof ack === 'function') ack({ ok });
      };
      if (!seat || seat.gameId !== gameId) {
        reply(false);
        return;
      }
      const afterSeq = afterSeqOf(body);
      // Re-read the seat: the host may have changed since this socket connected (WW-1303).
      void this.currentSeat(seat.id)
        .then(async (current) => {
          if (!current || current.gameId !== gameId) throw new Error('seat gone');
          const rooms = [`game:${gameId}:public`, `game:${gameId}:player:${current.id}`];
          if (current.isHost) rooms.push(`game:${gameId}:host`);
          else socket.leave(`game:${gameId}:host`);
          await socket.join(rooms);
          return this.events.since(gameId, current, afterSeq);
        })
        .then((caughtUp) => {
          for (const event of caughtUp.events) socket.emit(event.type, event);
          reply(true);
        })
        .catch(() => reply(false));
    });
  }
}

function clientEvent(event: StoredEvent) {
  return { seq: event.seq, type: event.type, audience: event.audience, payload: event.payload };
}

function roomFor(event: StoredEvent): string | null {
  if (event.audience === 'PUBLIC') return `game:${event.gameId}:public`;
  if (event.audience === 'HOST') return `game:${event.gameId}:host`;
  if (event.recipientPlayerId) return `game:${event.gameId}:player:${event.recipientPlayerId}`;
  return null;
}

function afterSeqOf(body: unknown): number {
  if (typeof body !== 'object' || body === null || !('afterSeq' in body)) return 0;
  const value = body.afterSeq;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function tokenOf(socket: Socket): string {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token.trim()) return auth.token.trim();
  const query = socket.handshake.query['token'];
  return typeof query === 'string' ? query.trim() : '';
}

/** Room names the server assigns. Tests and WW-1102 emit to these. */
export function playRooms(gameId: string, playerId: string, isHost: boolean): string[] {
  const rooms = [`game:${gameId}:public`, `game:${gameId}:player:${playerId}`];
  if (isHost) rooms.push(`game:${gameId}:host`);
  return rooms;
}

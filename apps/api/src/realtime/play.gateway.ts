import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { Server, type Socket } from 'socket.io';
import { hashToken } from '../auth/seat.js';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers } from '../db/schema.js';

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
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  onApplicationBootstrap(): void {
    if (this.io) return;
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    this.io = new Server(httpServer, { cors: { origin: false } });
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

  private async authenticate(socket: Socket): Promise<SeatAuth | null> {
    const token = tokenOf(socket);
    if (!token) return null;
    const [seat] = await this.db.select().from(gamePlayers).where(eq(gamePlayers.tokenHash, hashToken(token))).limit(1);
    if (!seat) return null;
    return { id: seat.id, gameId: seat.gameId, isHost: seat.isHost };
  }

  private onConnection(socket: Socket): void {
    // Server-to-client only. A client-originated fact is not relayed.
    for (const type of ['INFECTION_OCCURRED', 'ROLE_ASSIGNED', 'ROLE_CONVERTED', 'INVESTIGATION_RESULT', 'PLAYER_ELIMINATED']) {
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
      const rooms = [`game:${gameId}:public`, `game:${gameId}:player:${seat.id}`];
      if (seat.isHost) rooms.push(`game:${gameId}:host`);
      void Promise.resolve(socket.join(rooms)).then(
        () => reply(true),
        () => reply(false),
      );
    });
  }
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

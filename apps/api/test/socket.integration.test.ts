import type { INestApplication } from '@nestjs/common';
import { seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { PlayGateway } from '../src/realtime/play.gateway.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1101. A token joins only its own player room. A token from another game
 * cannot enter that room, and a client-emitted infection fact is not relayed.
 */

let db: TestDatabase;
let app: INestApplication;
let port: number;

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

async function seat(name: string, roomCode?: string): Promise<SeatCredentials> {
  if (!roomCode) {
    const created = await api().post('/api/v1/games').send({ displayName: name, mode: 'CLASSIC' }).expect(201);
    return seatCredentialsSchema.parse(created.body);
  }
  const joined = await api().post('/api/v1/games/join').send({ roomCode, displayName: name }).expect(201);
  return seatCredentialsSchema.parse(joined.body);
}

function connect(token: string): Socket {
  return io(`http://127.0.0.1:${port}/play`, { auth: { token }, transports: ['websocket'] });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 4_000);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

describe('socket rooms (WW-1101)', () => {
  it('rejects a foreign token and ignores a client infection event', async () => {
    const host = await seat('Host');
    const guest = await seat('Guest', host.roomCode);
    const other = await seat('Other');

    const bad = connect('not-a-token');
    await expect(once(bad, 'connect_error')).resolves.toBeTruthy();
    bad.close();

    const hostSocket = connect(host.token);
    const guestSocket = connect(guest.token);
    const intruder = connect(other.token);
    await Promise.all([once(hostSocket, 'connect'), once(guestSocket, 'connect'), once(intruder, 'connect')]);

    const join = (socket: Socket, gameId: string, playerId?: string) =>
      new Promise<{ ok: boolean }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('join-session timed out')), 4_000);
        socket.emit('join-session', { gameId, playerId }, (result: { ok: boolean }) => {
          clearTimeout(timer);
          resolve(result);
        });
      });

    expect(await join(hostSocket, host.gameId, guest.playerId)).toEqual({ ok: true });
    expect(await join(guestSocket, host.gameId)).toEqual({ ok: true });
    expect(await join(intruder, host.gameId, guest.playerId)).toEqual({ ok: false });

    const roomsOf = (socket: Socket) => app.get(PlayGateway).io?.of('/play').sockets.get(socket.id!)?.rooms ?? new Set<string>();
    expect([...roomsOf(hostSocket)]).toEqual(expect.arrayContaining([`game:${host.gameId}:public`, `game:${host.gameId}:player:${host.playerId}`, `game:${host.gameId}:host`]));
    expect([...roomsOf(hostSocket)]).not.toContain(`game:${host.gameId}:player:${guest.playerId}`);
    expect([...roomsOf(guestSocket)]).toContain(`game:${host.gameId}:player:${guest.playerId}`);
    expect([...roomsOf(guestSocket)]).not.toContain(`game:${host.gameId}:host`);
    expect([...roomsOf(intruder)].some((room) => room.startsWith('game:'))).toBe(false);

    const heard: unknown[] = [];
    guestSocket.on('INFECTION_OCCURRED', (payload) => heard.push(payload));
    hostSocket.emit('INFECTION_OCCURRED', { roleId: 'infected_wolf', sourcePlayerId: host.playerId });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(heard).toEqual([]);

    hostSocket.close();
    guestSocket.close();
    intruder.close();
  });
});

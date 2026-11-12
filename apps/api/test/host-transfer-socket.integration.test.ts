import type { INestApplication } from '@nestjs/common';
import { seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { PlayGateway } from '../src/realtime/play.gateway.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1303 finding: socket rooms were fixed at connect, so after a host
 * transfer the old host's open socket kept hearing host-only events. Now the
 * rooms move with the transfer, and `join-session` re-reads the seat.
 */

let db: TestDatabase;
let app: INestApplication;
let port: number;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });

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

function connect(token: string): Socket {
  return io(`http://127.0.0.1:${port}/play`, { auth: { token }, transports: ['websocket'] });
}

function once(socket: Socket, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 4_000);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function join(socket: Socket, gameId: string): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-session timed out')), 4_000);
    socket.emit('join-session', { gameId }, (result: { ok: boolean }) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/** Emits one host-only event and reports which sockets heard it. */
async function hostEventHeardBy(gameId: string, sockets: Record<string, Socket>): Promise<string[]> {
  const heard: string[] = [];
  const listeners = Object.entries(sockets).map(([name, socket]) => {
    const handler = () => heard.push(name);
    socket.on('HOST_PROBE', handler);
    return () => socket.off('HOST_PROBE', handler);
  });
  app.get(PlayGateway).emitStored([{ gameId, seq: 999, type: 'HOST_PROBE', audience: 'HOST', recipientPlayerId: null, payload: {} }]);
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const off of listeners) off();
  return heard.sort();
}

describe('host transfer and the host room', () => {
  it('moves host-only events to the new host and keeps the old host out', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const heir = seatCredentialsSchema.parse((await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Heir' }).expect(201)).body);

    const sockets = { oldHost: connect(host.token), heir: connect(heir.token) };
    try {
      await Promise.all(Object.values(sockets).map((s) => once(s, 'connect')));
      for (const socket of Object.values(sockets)) expect(await join(socket, host.gameId)).toEqual({ ok: true });
      expect(await hostEventHeardBy(host.gameId, sockets)).toEqual(['oldHost']);

      await api().post(`/api/v1/games/${host.gameId}/host/transfer`).set(bearer(host)).send({ playerId: heir.playerId }).expect(200);
      expect(await hostEventHeardBy(host.gameId, sockets)).toEqual(['heir']);

      // Rejoining does not put the old host back in the host room.
      expect(await join(sockets.oldHost, host.gameId)).toEqual({ ok: true });
      expect(await hostEventHeardBy(host.gameId, sockets)).toEqual(['heir']);
    } finally {
      for (const socket of Object.values(sockets)) socket.close();
    }
  });
});

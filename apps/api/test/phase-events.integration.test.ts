import type { INestApplication } from '@nestjs/common';
import { gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { EventService } from '../src/events/event.service.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1103. Closing the night tells every connected seat at once. The payload
 * is the new phase, with no role.
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

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 8_000);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function join(socket: Socket, gameId: string): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-session timed out')), 4_000);
    socket.emit('join-session', { gameId, afterSeq: 0 }, (result: { ok: boolean }) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

async function state(seat: SeatCredentials): Promise<GameState> {
  return gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat)).expect(200)).body);
}

describe('phase banners (WW-1103)', () => {
  it('moves the host and a guest from night to day on the same signal', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const seats = [host];
    for (let i = 2; i <= 10; i++) {
      const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
      seats.push(seatCredentialsSchema.parse(joined.body));
    }
    const guest = seats[1]!;
    await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);

    let current = await state(host);
    while (current.phase !== 'NIGHT_SUBMIT') {
      current = gameStateSchema.parse(
        (await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: current.stateVersion }).expect(200)).body,
      );
    }

    const hostSocket = connect(host.token);
    const guestSocket = connect(guest.token);
    await Promise.all([once(hostSocket, 'connect'), once(guestSocket, 'connect')]);
    expect(await join(hostSocket, host.gameId)).toEqual({ ok: true });
    expect(await join(guestSocket, host.gameId)).toEqual({ ok: true });

    const hostSignal = once<{ seq: number; audience: string; payload: { phase: string; roundNumber: number } }>(hostSocket, 'PHASE_CHANGED');
    const guestSignal = once<{ seq: number; audience: string; payload: { phase: string; roundNumber: number } }>(guestSocket, 'PHASE_CHANGED');
    const next = gameStateSchema.parse(
      (await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: current.stateVersion }).expect(200)).body,
    );
    const [forHost, forGuest] = await Promise.all([hostSignal, guestSignal]);

    expect(next.phase).not.toBe('NIGHT_SUBMIT');
    expect(forHost).toEqual(forGuest);
    expect(forHost.audience).toBe('PUBLIC');
    expect(forHost.payload).toMatchObject({ phase: next.phase, roundNumber: next.roundNumber, stateVersion: next.stateVersion });
    expect(JSON.stringify(forHost.payload)).not.toMatch(/wolf|villager|seeker|doctor/i);

    expect(await app.get(EventService).publishPhase(host.gameId, next.phase, next.roundNumber, next.stateVersion)).toEqual([]);
    hostSocket.close();
    guestSocket.close();
  });
});

import type { INestApplication } from '@nestjs/common';
import {
  chatMessageSchema,
  chatViewSchema,
  errorBodySchema,
  gameStateSchema,
  seatCredentialsSchema,
  type ChatView,
  type GameState,
  type SeatCredentials,
} from '@warewolf/contracts';
import { CHAT_RATE_WINDOW_MS } from '@warewolf/domain';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1104: table chat under the OD-72 rules. Living players post in day
 * discussion and the ballots; the dead read only; the host deletes and
 * mutes; every seat in the game, and nobody else, hears each message; and
 * the channel is emptied when the game ends.
 */

let db: TestDatabase;
let app: INestApplication;
let port: number;
let now = Date.parse('2026-11-11T10:00:00.000Z');

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const errorCode = (body: unknown) => errorBodySchema.parse(body).error.code;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false, overrides: { clock: { now: () => new Date(now) } } });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

async function classic(): Promise<{ host: SeatCredentials; seats: SeatCredentials[] }> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  const seats = [host];
  for (let i = 2; i <= 10; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
  return { host, seats };
}

async function state(seat: SeatCredentials): Promise<GameState> {
  return gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat)).expect(200)).body);
}

async function close(host: SeatCredentials): Promise<GameState> {
  const current = await state(host);
  if (current.phase === 'NIGHT_HOST_CONFIRM') {
    const view = await api().get(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).expect(200);
    if ((view.body as { decision: unknown }).decision === null) {
      await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ noKill: true }).expect(200);
    }
  }
  return gameStateSchema.parse((await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: current.stateVersion }).expect(200)).body);
}

async function closeUntil(host: SeatCredentials, phase: GameState['phase']): Promise<GameState> {
  let current = await state(host);
  for (let i = 0; current.phase !== phase; i++) {
    if (i > 12) throw new Error(`never reached ${phase}, stuck on ${current.phase}`);
    current = await close(host);
  }
  return current;
}

const post = (seat: SeatCredentials, body: unknown) => api().post(`/api/v1/games/${seat.gameId}/chat/messages`).set(bearer(seat)).send({ body });
const view = async (seat: SeatCredentials): Promise<ChatView> => chatViewSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/chat`).set(bearer(seat)).expect(200)).body);
const mute = (host: SeatCredentials, playerId: string) => api().put(`/api/v1/games/${host.gameId}/chat/mutes/${playerId}`).set(bearer(host));
const unmute = (host: SeatCredentials, playerId: string) => api().delete(`/api/v1/games/${host.gameId}/chat/mutes/${playerId}`).set(bearer(host));
const rows = async (table: 'chat_messages' | 'chat_mutes', gameId: string) =>
  Number((await db.pool.query<{ n: string }>(`select count(*) as n from ${table} where game_id = $1`, [gameId])).rows[0]!.n);

function connect(token: string): Socket {
  return io(`http://127.0.0.1:${port}/play`, { auth: { token }, transports: ['websocket'] });
}

function joinSession(socket: Socket, gameId: string): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-session timed out')), 4_000);
    socket.emit('join-session', { gameId }, (result: { ok: boolean }) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
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

describe('posting (OD-72)', () => {
  it('is closed on the reveal and at night, and open in discussion and the ballots', async () => {
    const { host, seats } = await classic();
    const [, a] = seats;
    const closed = errorBodySchema.parse((await post(a!, 'hello').expect(409)).body).error;
    expect(closed).toEqual({ code: 'CHAT_CLOSED', message: 'Chat opens in day discussion and voting.' });
    expect((await view(a!)).you).toEqual({ canPost: false, refusal: 'CLOSED' });

    await closeUntil(host, 'NIGHT_SUBMIT');
    expect(errorCode((await post(a!, 'psst').expect(409)).body)).toBe('CHAT_CLOSED');
    await closeUntil(host, 'DAY_ANNOUNCE');
    expect(errorCode((await post(a!, 'too early').expect(409)).body)).toBe('CHAT_CLOSED');

    await closeUntil(host, 'DAY_DISCUSSION');
    const first = chatMessageSchema.parse((await post(a!, '  I trust Player 3.  ').expect(201)).body);
    expect(first).toMatchObject({ playerId: a!.playerId, body: 'I trust Player 3.', roundNumber: 1, phase: 'DAY_DISCUSSION' });

    await closeUntil(host, 'VOTING');
    const second = chatMessageSchema.parse((await post(host, 'Vote now.').expect(201)).body);
    expect(second.seq).toBeGreaterThan(first.seq);

    // Every seat reads the same channel, oldest first.
    for (const seat of [host, a!, seats[5]!]) {
      expect((await view(seat)).messages.map((m) => m.body)).toEqual(['I trust Player 3.', 'Vote now.']);
    }
  });

  it('refuses blank text and more than 280 characters with 422', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    expect(errorCode((await post(seats[1]!, '   ').expect(422)).body)).toBe('VALIDATION_FAILED');
    expect(errorCode((await post(seats[1]!, 'x'.repeat(281)).expect(422)).body)).toBe('VALIDATION_FAILED');
    expect(errorCode((await post(seats[1]!, 42).expect(422)).body)).toBe('VALIDATION_FAILED');
    await post(seats[1]!, 'x'.repeat(280)).expect(201);
  });

  it('allows 5 posts per 10 seconds per seat, then 429', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    const [, a, b] = seats;
    for (let i = 1; i <= 5; i++) await post(a!, `message ${i}`).expect(201);
    expect(errorCode((await post(a!, 'one too many').expect(429)).body)).toBe('RATE_LIMITED');
    // The budget is the seat's own.
    await post(b!, 'my turn').expect(201);
    now += CHAT_RATE_WINDOW_MS + 1;
    await post(a!, 'after the window').expect(201);
  });

  it('keeps the dead read only', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    const [, a, dead] = seats;
    await post(a!, 'before').expect(201);
    await db.pool.query(`update game_players set life_status = 'DEAD', died_round = 1 where id = $1`, [dead!.playerId]);
    expect(errorBodySchema.parse((await post(dead!, 'from beyond').expect(403)).body).error).toEqual({ code: 'CHAT_READ_ONLY', message: 'The dead read only.' });
    const seen = await view(dead!);
    expect(seen.you).toEqual({ canPost: false, refusal: 'DEAD' });
    expect(seen.messages.map((m) => m.body)).toEqual(['before']);
  });
});

describe('host moderation', () => {
  it('mutes and unmutes a seat; only the host may', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    const [, a, b] = seats;

    expect(errorCode((await mute(a!, b!.playerId).expect(403)).body)).toBe('NOT_HOST');
    expect(errorCode((await mute(host, host.playerId).expect(422)).body)).toBe('VALIDATION_FAILED');
    expect(errorCode((await mute(host, '00000000-0000-4000-8000-000000000000').expect(404)).body)).toBe('NOT_FOUND');

    await mute(host, b!.playerId).expect(204);
    await mute(host, b!.playerId).expect(204);
    expect(errorBodySchema.parse((await post(b!, 'let me speak').expect(403)).body).error).toEqual({ code: 'CHAT_MUTED', message: 'The host muted you.' });
    const seen = await view(a!);
    expect(seen.mutedPlayerIds).toEqual([b!.playerId]);
    expect((await view(b!)).you).toEqual({ canPost: false, refusal: 'MUTED' });

    await unmute(host, b!.playerId).expect(204);
    await post(b!, 'thank you').expect(201);
    expect((await view(a!)).mutedPlayerIds).toEqual([]);
  });

  it('deletes a message; only the host may', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    const [, a] = seats;
    const message = chatMessageSchema.parse((await post(a!, 'something rude').expect(201)).body);
    const path = `/api/v1/games/${host.gameId}/chat/messages/${message.messageId}`;

    expect(errorCode((await api().delete(path).set(bearer(a!)).expect(403)).body)).toBe('NOT_HOST');
    await api().delete(path).set(bearer(host)).expect(204);
    expect((await view(a!)).messages).toEqual([]);
    expect(errorCode((await api().delete(path).set(bearer(host)).expect(404)).body)).toBe('NOT_FOUND');

    // A message id from another game is not found here.
    const other = await classic();
    await closeUntil(other.host, 'DAY_DISCUSSION');
    const foreign = chatMessageSchema.parse((await post(other.seats[1]!, 'elsewhere').expect(201)).body);
    await api().delete(`/api/v1/games/${host.gameId}/chat/messages/${foreign.messageId}`).set(bearer(host)).expect(404);
    expect((await view(other.host)).messages).toHaveLength(1);
  });

  it('refuses a token from another game', async () => {
    const one = await classic();
    const two = await classic();
    await api().get(`/api/v1/games/${one.host.gameId}/chat`).set(bearer(two.host)).expect(404);
    await api().post(`/api/v1/games/${one.host.gameId}/chat/messages`).set(bearer(two.seats[1]!)).send({ body: 'hi' }).expect(404);
  });
});

describe('fan-out', () => {
  it('reaches every seat in the game, and no seat in another game', async () => {
    const { host, seats } = await classic();
    const other = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    const [, a, b] = seats;

    const listeners = [connect(host.token), connect(b!.token), connect(other.seats[1]!.token)];
    try {
      await Promise.all(listeners.map((s) => once(s, 'connect')));
      const joined = await Promise.all([joinSession(listeners[0]!, host.gameId), joinSession(listeners[1]!, host.gameId), joinSession(listeners[2]!, other.host.gameId)]);
      expect(joined.every((r) => r.ok)).toBe(true);

      const leaked: unknown[] = [];
      listeners[2]!.on('CHAT_MESSAGE_POSTED', (m: unknown) => leaked.push(m));

      const heardByHost = once<unknown>(listeners[0]!, 'CHAT_MESSAGE_POSTED');
      const heardByB = once<unknown>(listeners[1]!, 'CHAT_MESSAGE_POSTED');
      const sent = chatMessageSchema.parse((await post(a!, 'can everyone hear me?').expect(201)).body);
      expect(chatMessageSchema.parse(await heardByHost)).toEqual(sent);
      expect(chatMessageSchema.parse(await heardByB)).toEqual(sent);

      const muted = once<{ playerId: string }>(listeners[1]!, 'CHAT_SEAT_MUTED');
      await mute(host, a!.playerId).expect(204);
      expect(await muted).toEqual({ playerId: a!.playerId });

      const deleted = once<{ messageId: string }>(listeners[1]!, 'CHAT_MESSAGE_DELETED');
      await api().delete(`/api/v1/games/${host.gameId}/chat/messages/${sent.messageId}`).set(bearer(host)).expect(204);
      expect(await deleted).toEqual({ messageId: sent.messageId });

      // A client cannot inject a chat message over the socket.
      const injected: unknown[] = [];
      listeners[0]!.on('CHAT_MESSAGE_POSTED', (m: unknown) => injected.push(m));
      listeners[1]!.emit('CHAT_MESSAGE_POSTED', { body: 'forged' });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(injected).toEqual([]);
      expect(leaked).toEqual([]);
    } finally {
      for (const s of listeners) s.close();
    }
  });
});

describe('retention', () => {
  it('deletes messages and mutes when the host cancels', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    await post(seats[1]!, 'one').expect(201);
    await mute(host, seats[2]!.playerId).expect(204);
    expect(await rows('chat_messages', host.gameId)).toBe(1);

    await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(host)).expect(200);
    expect(await rows('chat_messages', host.gameId)).toBe(0);
    expect(await rows('chat_mutes', host.gameId)).toBe(0);
    expect(await view(seats[1]!)).toEqual({ messages: [], mutedPlayerIds: [], you: { canPost: false, refusal: 'CLOSED' } });
    expect(errorCode((await mute(host, seats[3]!.playerId).expect(409)).body)).toBe('PHASE_CONFLICT');
  });

  it('deletes messages when the game finishes, and leaves other games alone', async () => {
    const { host, seats } = await classic();
    const other = await classic();
    await closeUntil(host, 'DAY_DISCUSSION');
    await closeUntil(other.host, 'DAY_DISCUSSION');
    await post(seats[1]!, 'mine').expect(201);
    await post(other.seats[1]!, 'theirs').expect(201);

    await db.pool.query(`update games set status = 'FINISHED', phase = 'FINISHED', phase_ends_at = null where id = $1`, [host.gameId]);
    expect(await rows('chat_messages', host.gameId)).toBe(0);
    expect(await rows('chat_messages', other.host.gameId)).toBe(1);
  });
});

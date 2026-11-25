import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { gameLogSchema, lobbyProjectionSchema, seatCredentialsSchema, type GameLog, type SeatCredentials } from '@warewolf/contracts';
import { GameDriver, Http, play, villageWin } from '@warewolf/e2e-tools';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { PresenceService } from '../src/realtime/presence.service.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * ID-01 (device key and rejoin code), ID-02 (presence), LOG-01 (the log).
 */

let db: TestDatabase;
let app: INestApplication;
let port: number;
let http: Http;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const deviceKey = () => randomBytes(32).toString('base64url');

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  port = typeof address === 'object' && address ? address.port : 0;
  http = new Http(`http://127.0.0.1:${port}`);
}, 60_000);

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

async function create(name: string, key?: string): Promise<SeatCredentials> {
  const res = await api().post('/api/v1/games').send({ displayName: name, mode: 'CLASSIC', ...(key ? { deviceKey: key } : {}) }).expect(201);
  return seatCredentialsSchema.parse(res.body);
}

async function join(roomCode: string, name: string, key?: string): Promise<SeatCredentials> {
  const res = await api().post('/api/v1/games/join').send({ roomCode, displayName: name, ...(key ? { deviceKey: key } : {}) }).expect(201);
  return seatCredentialsSchema.parse(res.body);
}

async function log(seat: SeatCredentials, path = 'log'): Promise<GameLog> {
  const res = await api().get(`/api/v1/games/${seat.gameId}/${path}`).set(bearer(seat)).expect(200);
  return gameLogSchema.parse(res.body);
}

const entries = (l: GameLog) => [...l.lobby, ...l.rounds.flatMap((r) => [...r.night, ...r.day]), ...l.end];

function connect(token: string): Socket {
  return io(`http://127.0.0.1:${port}/play`, { auth: { token }, transports: ['websocket'], reconnection: false });
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

async function joinSession(socket: Socket, gameId: string): Promise<void> {
  await once(socket, 'connect');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-session timed out')), 4_000);
    socket.emit('join-session', { gameId, afterSeq: 0 }, (result: { ok: boolean }) => {
      clearTimeout(timer);
      if (result.ok) resolve();
      else reject(new Error('join-session refused'));
    });
  });
}

async function until(check: () => Promise<boolean>, ms = 3_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('condition not met in time');
}

describe('rejoin (ID-01)', () => {
  it('create and join return a rejoin code; the same device gets its seat back with a fresh token', async () => {
    const key = deviceKey();
    const host = await create('Host');
    const first = await join(host.roomCode, 'Mira', key);
    expect(first.rejoinCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(first.resumed).toBe(false);

    // Same device, any name: the seat comes back. No second seat, no "name taken".
    const again = await join(host.roomCode, 'Someone else', key);
    expect(again).toMatchObject({ playerId: first.playerId, resumed: true, isHost: false });
    expect(again.token).not.toBe(first.token);
    expect(again.rejoinCode).not.toBe(first.rejoinCode);
    await api().get(`/api/v1/games/${host.gameId}`).set(bearer(first)).expect(401);
    const lobby = lobbyProjectionSchema.parse((await api().get(`/api/v1/games/${host.gameId}`).set(bearer(again)).expect(200)).body);
    expect(lobby.players.map((p) => p.displayName)).toEqual(['Host', 'Mira']);
  });

  it('the rejoin code reclaims a seat from another device and closes the old sockets', async () => {
    const host = await create('Host');
    const guest = await join(host.roomCode, 'Ana');
    const old = connect(guest.token);
    await joinSession(old, guest.gameId);
    const revoked = once<{ reason: string }>(old, 'SEAT_REVOKED');
    const closed = once(old, 'disconnect');

    await api().post('/api/v1/games/rejoin').send({ roomCode: host.roomCode, rejoinCode: 'AAAA-AAAA' }).expect(404);
    const dashed = `${guest.rejoinCode!.slice(0, 4)}-${guest.rejoinCode!.slice(4).toLowerCase()}`;
    const res = await api().post('/api/v1/games/rejoin').send({ roomCode: host.roomCode, rejoinCode: dashed }).expect(200);
    const back = seatCredentialsSchema.parse(res.body);
    expect(back).toMatchObject({ playerId: guest.playerId, resumed: true });
    await expect(revoked).resolves.toEqual({ reason: 'SEAT_RECLAIMED' });
    await closed;
    await api().get(`/api/v1/games/${host.gameId}`).set(bearer(guest)).expect(401);
    // The used code is spent; the new one works.
    await api().post('/api/v1/games/rejoin').send({ roomCode: host.roomCode, rejoinCode: guest.rejoinCode }).expect(404);
    expect(entries(await log(back)).filter((e) => e.kind === 'SEAT_RECLAIMED')).toHaveLength(1);
    old.close();
  });

  it('a new code replaces the old one', async () => {
    const host = await create('Host');
    const res = await api().post(`/api/v1/games/${host.gameId}/me/rejoin-code`).set(bearer(host)).expect(200);
    expect(res.body.rejoinCode).toMatch(/^[A-Z2-9]{8}$/);
    await api().post('/api/v1/games/rejoin').send({ roomCode: host.roomCode, rejoinCode: host.rejoinCode }).expect(404);
    await api().post('/api/v1/games/rejoin').send({ roomCode: host.roomCode, rejoinCode: res.body.rejoinCode }).expect(200);
  });

  it('after start, only the seat’s own device or code gets back in', async () => {
    const key = deviceKey();
    const game = await GameDriver.create(http, { mode: 'CLASSIC' });
    await game.fill();
    // Reclaim the last seat by code so this device's key is bound to it.
    const target = game.seats[game.seats.length - 1]!;
    await game.start();
    await api().post('/api/v1/games/join').send({ roomCode: game.host.roomCode, displayName: 'Latecomer', deviceKey: key }).expect(409);
    const code = await api().post(`/api/v1/games/${target.gameId}/me/rejoin-code`).set(bearer(target)).expect(200);
    const back = seatCredentialsSchema.parse(
      (await api().post('/api/v1/games/rejoin').send({ roomCode: target.roomCode, rejoinCode: code.body.rejoinCode, deviceKey: key }).expect(200)).body,
    );
    expect(back.playerId).toBe(target.playerId);
    const viaDevice = await join(target.roomCode, 'Whatever', key);
    expect(viaDevice).toMatchObject({ playerId: target.playerId, resumed: true });
    await api().get(`/api/v1/games/${target.gameId}/state`).set(bearer(viaDevice)).expect(200);
    await game.cancel();
  });

  it('rate-limits rejoin guesses', async () => {
    const host = await create('Host');
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await api().post('/api/v1/games/rejoin').send({ roomCode: host.roomCode, rejoinCode: 'BBBBBBBB' })).status);
    expect(statuses.slice(0, 20).every((s) => s === 404)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('presence (ID-02)', () => {
  it('a socket marks the seat here; after the grace it is away and the log says so once', async () => {
    const presence = app.get(PresenceService);
    presence.graceMs = 150;
    const host = await create('Host');
    const guest = await join(host.roomCode, 'Ben');
    const lobby = async () => lobbyProjectionSchema.parse((await api().get(`/api/v1/games/${host.gameId}`).set(bearer(host)).expect(200)).body);
    const status = async () => (await lobby()).players.find((p) => p.playerId === guest.playerId)?.connectionStatus;

    const first = connect(guest.token);
    await joinSession(first, guest.gameId);
    expect(await status()).toBe('CONNECTED');

    // A reload: the socket closes and another opens inside the grace. Nothing is logged.
    first.close();
    const second = connect(guest.token);
    await joinSession(second, guest.gameId);
    await new Promise((r) => setTimeout(r, 300));
    expect(await status()).toBe('CONNECTED');
    expect(entries(await log(host)).some((e) => e.kind === 'PLAYER_DISCONNECTED')).toBe(false);

    second.close();
    await until(async () => (await status()) === 'DISCONNECTED');
    const third = connect(guest.token);
    await joinSession(third, guest.gameId);
    await until(async () => entries(await log(host)).some((e) => e.kind === 'PLAYER_RECONNECTED'));
    const kinds = entries(await log(host)).map((e) => e.kind);
    expect(kinds.filter((k) => k === 'PLAYER_DISCONNECTED')).toHaveLength(1);
    third.close();
    presence.graceMs = 20_000;
  });
});

describe('game log (LOG-01)', () => {
  it('lobby: created, joined, kicked, host changed, with names of removed seats', async () => {
    const host = await create('Host');
    const ana = await join(host.roomCode, 'Ana');
    const ben = await join(host.roomCode, 'Ben');
    await api().post(`/api/v1/games/${host.gameId}/players/${ben.playerId}/kick`).set(bearer(host)).expect(200);
    await api().post(`/api/v1/games/${host.gameId}/host/transfer`).set(bearer(host)).send({ playerId: ana.playerId }).expect(200);
    const l = await log(ana);
    expect(l.lobby.map((e) => e.kind)).toEqual(['ROOM_CREATED', 'PLAYER_JOINED', 'PLAYER_JOINED', 'PLAYER_KICKED', 'HOST_CHANGED']);
    const kick = l.lobby.find((e) => e.kind === 'PLAYER_KICKED')!;
    expect(kick.targets[0]?.displayName).toBe('Ben');
    expect(kick.actors[0]?.displayName).toBe('Host');
    // The kicked seat's token is gone.
    await api().get(`/api/v1/games/${host.gameId}/log`).set(bearer(ben)).expect(401);
  });

  it('hides every secret while the game runs and reveals them when it ends', async () => {
    const game = await GameDriver.create(http, { mode: 'CLASSIC' });
    await game.fill();
    await game.start();
    await play(game, { policy: villageWin, stopWhen: (s) => s.phase === 'VOTING' });
    const villager = game.seats[1]!;

    const during = await log(villager);
    expect(during.revealed).toBe(false);
    const live = entries(during);
    expect(live.some((e) => e.visibility === 'REVEALED')).toBe(false);
    expect(live.some((e) => ['ROLE_DEALT', 'NIGHT_ACTION', 'KILL', 'BALLOT', 'SAVE', 'INFECTION', 'CONVERSION', 'INVESTIGATION'].includes(e.kind))).toBe(false);
    // Private entries are the viewer's own.
    for (const e of live.filter((x) => x.visibility === 'PRIVATE' && x.kind !== 'PRIVATE_NOTICE')) expect(e.actors.map((p) => p.playerId)).toEqual([villager.playerId]);
    expect(JSON.stringify(during)).not.toMatch(/"roleId":"(alpha_wolf|pack_wolf|seer|doctor|guard)"/);
    await api().get(`/api/v1/games/${villager.gameId}/host/log`).set(bearer(villager)).expect(403);
    expect((await log(game.host, 'host/log')).revealed).toBe(true);

    await play(game, { policy: villageWin });
    expect((await game.state()).status).toBe('FINISHED');
    const after = await log(villager);
    expect(after.revealed).toBe(true);
    const all = entries(after);
    expect(all.filter((e) => e.kind === 'ROLE_DEALT')).toHaveLength(game.seats.length);
    expect(all.some((e) => e.kind === 'KILL' && e.stage === 'DAY' && e.detail.byVote)).toBe(true);
    expect(all.some((e) => e.kind === 'BALLOT')).toBe(true);
    expect(after.end.map((e) => e.kind)).toContain('GAME_FINISHED');
  });
});

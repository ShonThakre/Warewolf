import type { INestApplication } from '@nestjs/common';
import { castVoteResponseSchema, errorBodySchema, gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-901: a tie opens one revote, and a second tie eliminates nobody (OD-40).
 * The close is the existing host phase close.
 */

let db: TestDatabase;
let app: INestApplication;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const errorCode = (body: unknown) => errorBodySchema.parse(body).error.code;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
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

function vote(seat: SeatCredentials, targetPlayerId: string | null) {
  return api().post(`/api/v1/games/${seat.gameId}/votes`).set(bearer(seat)).send({ targetPlayerId });
}

const life = async (playerId: string) =>
  (await db.pool.query<{ life_status: string }>(`select life_status from game_players where id = $1`, [playerId])).rows[0]!.life_status;

describe('ballots', () => {
  it('opens a revote on a tie, then eliminates the revote leader', async () => {
    const { host, seats } = await classic();
    const [a, b, c, d] = seats;
    expect(errorCode((await vote(a!, null).expect(409)).body)).toBe('PHASE_CONFLICT');

    await closeUntil(host, 'VOTING');
    expect(castVoteResponseSchema.parse((await vote(a!, null).expect(200)).body)).toMatchObject({ ballot: 1, targetPlayerId: null, supersedes: null });
    const first = castVoteResponseSchema.parse((await vote(b!, c!.playerId).expect(200)).body);
    const replaced = castVoteResponseSchema.parse((await vote(b!, d!.playerId).expect(200)).body);
    expect(replaced).toMatchObject({ ballot: 1, targetPlayerId: d!.playerId });
    expect(replaced.supersedes).toBeTruthy();
    expect(first.supersedes).toBeNull();
    await vote(c!, b!.playerId).expect(200);

    expect(await close(host)).toMatchObject({ phase: 'REVOTE', roundNumber: 1 });
    expect(errorCode((await vote(a!, c!.playerId).expect(409)).body)).toBe('VOTE_INELIGIBLE');
    await vote(b!, d!.playerId).expect(200);
    await vote(c!, d!.playerId).expect(200);
    expect(await close(host)).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });
    expect(await life(d!.playerId)).toBe('DEAD');
    expect(await life(b!.playerId)).toBe('ALIVE');

    await closeUntil(host, 'VOTING');
    expect(errorCode((await vote(d!, c!.playerId).expect(409)).body)).toBe('VOTE_INELIGIBLE');
  });

  it('eliminates nobody when the revote ties as well', async () => {
    const { host, seats } = await classic();
    const [, b, c, d] = seats;
    await closeUntil(host, 'VOTING');
    await vote(b!, c!.playerId).expect(200);
    await vote(c!, d!.playerId).expect(200);
    expect(await close(host)).toMatchObject({ phase: 'REVOTE' });
    await vote(b!, c!.playerId).expect(200);
    await vote(c!, d!.playerId).expect(200);
    expect(await close(host)).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });
    expect(await life(c!.playerId)).toBe('ALIVE');
    expect(await life(d!.playerId)).toBe('ALIVE');
  });
});

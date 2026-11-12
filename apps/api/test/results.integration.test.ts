import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  errorBodySchema,
  gameResultsSchema,
  gameStateSchema,
  seatCredentialsSchema,
  type FinishedResults,
  type GameState,
  type SeatCredentials,
} from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-903a: the recap comes from what actually ended the game. A Classic game
 * is played to a village win through the real resolvers: quiet nights, and
 * the table votes each wolf out in turn.
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
    await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ noKill: true }).expect(200);
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

async function roleSeats(gameId: string, seats: SeatCredentials[], roleId: string): Promise<SeatCredentials[]> {
  const { rows } = await db.pool.query<{ player_id: string }>(
    `select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id`,
    [gameId, roleId],
  );
  return rows.map((row) => seats.find((s) => s.playerId === row.player_id)!);
}

const results = (seat: SeatCredentials) => api().get(`/api/v1/games/${seat.gameId}/results`).set(bearer(seat));

/** Every living seat votes for `target`. */
async function voteOut(seats: SeatCredentials[], target: SeatCredentials) {
  const { rows } = await db.pool.query<{ id: string }>(`select id from game_players where game_id = $1 and life_status = 'ALIVE'`, [target.gameId]);
  const alive = new Set(rows.map((r) => r.id));
  for (const seat of seats.filter((s) => alive.has(s.playerId) && s.playerId !== target.playerId)) {
    await api().post(`/api/v1/games/${seat.gameId}/votes`).set(bearer(seat)).send({ targetPlayerId: target.playerId }).expect(200);
  }
}

describe('GET /games/:gameId/results', () => {
  it('is refused while the game runs, and reveals every role once the village wins', async () => {
    const { host, seats } = await classic();
    expect(errorCode((await results(seats[3]!).expect(409)).body)).toBe('PHASE_CONFLICT');

    const wolves = await roleSeats(host.gameId, seats, 'pack_wolf');
    const [seeker] = await roleSeats(host.gameId, seats, 'seeker');
    expect(wolves.length).toBeGreaterThan(0);

    await closeUntil(host, 'NIGHT_SUBMIT');
    if (seeker) {
      const { rows } = await db.pool.query<{ id: string }>(`select id from ability_instances where player_id = $1 and ability_id = 'seeker_investigate'`, [seeker.playerId]);
      await api()
        .post(`/api/v1/games/${host.gameId}/actions`)
        .set(bearer(seeker))
        .set('Idempotency-Key', randomUUID())
        .send({ abilityInstanceId: rows[0]!.id, targetPlayerIds: [wolves[0]!.playerId] })
        .expect(200);
    }

    let current: GameState = await state(host);
    for (const wolf of wolves) {
      current = await closeUntil(host, 'VOTING');
      await voteOut(seats, wolf);
      current = await close(host);
    }
    expect(current.status).toBe('FINISHED');
    expect(errorCode((await results({ ...host, gameId: randomUUID() }).expect(404)).body)).toBe('NOT_FOUND');

    const body = gameResultsSchema.parse((await results(seats[5]!).expect(200)).body) as FinishedResults;
    expect(body).toMatchObject({ status: 'FINISHED', winningTeam: 'VILLAGE', draw: false, infections: [] });
    // One public tally per day the wolves were voted out, with no voter ids (OD-85).
    expect(body.tallies.map((t) => t.votedOutPlayerId)).toEqual(wolves.map((w) => w.playerId));
    expect(body.seats.map((s) => s.seatNumber)).toEqual([...body.seats.map((s) => s.seatNumber)].sort((a, b) => a - b));
    expect(body.seats).toHaveLength(10);

    const wolfIds = new Set(wolves.map((w) => w.playerId));
    for (const seat of body.seats) {
      expect(seat.finalRoleId).toBe(seat.originalRoleId);
      if (wolfIds.has(seat.playerId)) {
        expect(seat).toMatchObject({ originalRoleId: 'pack_wolf', originalFaction: 'WOLF_PACK', lifeStatus: 'DEAD', won: false });
        expect(seat.death).toMatchObject({ phaseKind: 'DAY', roleId: 'pack_wolf' });
      } else {
        expect(seat.lifeStatus).toBe('ALIVE');
        expect(seat.death).toBeNull();
        if (seat.finalFaction === 'VILLAGE') expect(seat.won).toBe(true);
      }
    }
    if (seeker) expect(body.seats.find((s) => s.playerId === seeker.playerId)!.abilityUses).toBe(1);

    // Every seat, alive or dead, reads the same recap.
    expect((await results(wolves[0]!).expect(200)).body).toEqual(body);
  });

  it('reveals no role after a cancel', async () => {
    const { host, seats } = await classic();
    await closeUntil(host, 'NIGHT_SUBMIT');
    await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(host)).expect(200);
    const res = await results(seats[2]!).expect(200);
    const body = gameResultsSchema.parse(res.body);
    expect(body).toMatchObject({ status: 'CANCELLED', cancelReason: 'HOST' });
    expect(body.seats).toHaveLength(10);
    const text = JSON.stringify(res.body);
    for (const leak of ['pack_wolf', 'seeker', 'Role', 'faction', 'VILLAGE', 'WOLF_PACK']) expect(text).not.toContain(leak);
  });

  it('is refused in the lobby', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    expect(errorCode((await results(host).expect(409)).body)).toBe('PHASE_CONFLICT');
  });
});

import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { errorBodySchema, seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/seat.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { JOIN_ROOM_LIMIT } from '../src/http/rate-limit.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1301. Tokens stay hashed, a quoted name is stored as text, 409 and 422
 * bodies do not name another player's role, and a burst of joins is 429.
 */

let db: TestDatabase;
let app: INestApplication;

const api = () => request(app.getHttpServer());
const auth = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const roleIds = DEFAULT_CATALOG.roles.map((role) => role.id);

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

describe('security (WW-1301)', () => {
  it('stores a hash of the seat token and keeps a quoted name as text', async () => {
    const name = `a';drop table games;--`;
    const created = await api().post('/api/v1/games').send({ displayName: name, mode: 'CLASSIC' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const { rows } = await db.pool.query<{ token_hash: string; display_name: string }>(
      `select token_hash, display_name from game_players where id = $1`,
      [host.playerId],
    );
    expect(rows[0]?.token_hash).toBe(hashToken(host.token));
    expect(rows[0]?.token_hash).not.toContain(host.token);
    expect(rows[0]?.display_name).toBe(name);
    const tables = await db.pool.query(`select to_regclass('public.games') as games`);
    expect(tables.rows[0]).toEqual({ games: 'games' });
  });

  it('does not put another player role id in a 409 or a 422', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const seats = [host];
    for (let i = 2; i <= 10; i++) {
      const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
      seats.push(seatCredentialsSchema.parse(joined.body));
    }
    await api().post(`/api/v1/games/${host.gameId}/start`).set(auth(host)).send({ acknowledgeWarnings: true }).expect(200);

    const outsider = seatCredentialsSchema.parse((await api().post('/api/v1/games').send({ displayName: 'Other', mode: 'CLASSIC' }).expect(201)).body);
    const cross = await api().get(`/api/v1/games/${host.gameId}/host/roster`).set(auth(outsider)).expect(404);
    const forbidden = await api().get(`/api/v1/games/${host.gameId}/host/roster`).set(auth(seats[1]!)).expect(403);

    const opened = await api().get(`/api/v1/games/${host.gameId}/state`).set(auth(host)).expect(200);
    await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(auth(host)).send({ stateVersion: opened.body.stateVersion }).expect(200);
    const night = await api().get(`/api/v1/games/${host.gameId}/state`).set(auth(host)).expect(200);
    const stale = await api()
      .post(`/api/v1/games/${host.gameId}/host/phase/close`)
      .set(auth(host))
      .send({ stateVersion: opened.body.stateVersion })
      .expect(409);

    const { rows } = await db.pool.query<{ player_id: string; id: string }>(
      `select a.player_id, i.id from role_assignments a join ability_instances i on i.assignment_id = a.id
       where a.game_id = $1 and a.original_role_id = 'seeker' and i.ability_id = 'seeker_investigate'`,
      [host.gameId],
    );
    const seeker = seats.find((seat) => seat.playerId === rows[0]?.player_id)!;
    const illegal = await api()
      .post(`/api/v1/games/${host.gameId}/actions`)
      .set(auth(seeker))
      .set('Idempotency-Key', randomUUID())
      .send({ abilityInstanceId: rows[0]!.id, targetPlayerIds: [seeker.playerId] })
      .expect(422);

    expect(night.body.phase).toBe('NIGHT_SUBMIT');
    expect(errorBodySchema.parse(stale.body).error.code).toBe('PHASE_CONFLICT');
    expect(errorBodySchema.parse(illegal.body).error.code).toBe('ACTION_TARGET_ILLEGAL');
    for (const body of [cross.body, forbidden.body, stale.body, illegal.body]) {
      const text = JSON.stringify(body);
      for (const roleId of roleIds) expect(text).not.toContain(roleId);
    }
  });

  it('returns 429 when one room is joined too many times', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'INFECTION' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const statuses: number[] = [];
    for (let i = 0; i < JOIN_ROOM_LIMIT + 5; i++) {
      const res = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Seat ${i + 2}` });
      statuses.push(res.status);
    }
    expect(statuses.slice(JOIN_ROOM_LIMIT).every((status) => status === 429)).toBe(true);
    const again = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Late Name' });
    expect(again.status).toBe(429);
    expect(errorBodySchema.parse(again.body).error.code).toBe('RATE_LIMITED');
  });
});

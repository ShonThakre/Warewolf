import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  configurationResponseSchema,
  errorBodySchema,
  gameStateSchema,
  seatCredentialsSchema,
  type GameState,
  type SeatCredentials,
} from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1003b, OD-29: the Sniper fires during day discussion and the shot
 * resolves when discussion closes, before voting opens. Last night's
 * protection stops it. The shot is spent either way.
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

/** Classic with one villager swapped for a Sniper. */
async function classicWithSniper(sniper = true): Promise<{ host: SeatCredentials; seats: SeatCredentials[] }> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  const seats = [host];
  for (let i = 2; i <= 10; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  if (sniper) {
    const { draft } = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body);
    const roles = draft.roles.map((entry) => (entry.roleId === 'normal_villager' ? { ...entry, count: entry.count - 1 } : entry));
    await api()
      .put(`/api/v1/games/${host.gameId}/configuration`)
      .set(bearer(host))
      .send({ ...draft, roles: [...roles, { roleId: 'sniper', count: 1 }] })
      .expect(200);
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

async function seatsOf(gameId: string, seats: SeatCredentials[], roleId: string): Promise<SeatCredentials[]> {
  const { rows } = await db.pool.query<{ player_id: string }>(`select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id`, [gameId, roleId]);
  return rows.map((r) => seats.find((s) => s.playerId === r.player_id)!);
}

async function abilityOf(seat: SeatCredentials, abilityId: string) {
  const { rows } = await db.pool.query<{ id: string; status: string; charges_remaining: number | null }>(
    `select id, status, charges_remaining from ability_instances where player_id = $1 and ability_id = $2`,
    [seat.playerId, abilityId],
  );
  return rows[0]!;
}

const act = async (seat: SeatCredentials, abilityId: string, target: SeatCredentials, status = 200) =>
  (
    await api()
      .post(`/api/v1/games/${seat.gameId}/actions`)
      .set(bearer(seat))
      .set('Idempotency-Key', randomUUID())
      .send({ abilityInstanceId: (await abilityOf(seat, abilityId)).id, targetPlayerIds: [target.playerId] })
      .expect(status)
  ).body as unknown;

const life = async (seat: SeatCredentials) =>
  (await db.pool.query<{ life_status: string }>(`select life_status from game_players where id = $1`, [seat.playerId])).rows[0]!.life_status;

const vote = (seat: SeatCredentials, target: SeatCredentials) =>
  api().post(`/api/v1/games/${seat.gameId}/votes`).set(bearer(seat)).send({ targetPlayerId: target.playerId }).expect(200);

describe('Sniper (OD-29)', () => {
  it('leaves games without a day kill unchanged', async () => {
    const { host } = await classicWithSniper(false);
    const day = await closeUntil(host, 'DAY_DISCUSSION');
    expect(day.close).toEqual({ next: 'VOTING', resolves: null });
  });

  it('is stopped by last night’s protection, and the shot is still spent', async () => {
    const { host, seats } = await classicWithSniper();
    const [sniper] = await seatsOf(host.gameId, seats, 'sniper');
    const [doctor] = await seatsOf(host.gameId, seats, 'doctor');
    const villagers = (await seatsOf(host.gameId, seats, 'normal_villager')).filter((s) => s.playerId !== host.playerId);
    const guarded = villagers[0]!;

    await closeUntil(host, 'NIGHT_SUBMIT');
    await act(doctor!, 'doctor_save', guarded);
    // Not yet: the shot is a day ability.
    expect(errorCode(await act(sniper!, 'sniper_shot', guarded, 409))).toBe('ACTION_WRONG_PHASE');

    const day = await closeUntil(host, 'DAY_DISCUSSION');
    expect(day.close).toEqual({ next: null, resolves: 'DAY' });
    await act(sniper!, 'sniper_shot', guarded);
    expect(await close(host)).toMatchObject({ phase: 'VOTING', roundNumber: 1 });

    expect(await life(guarded)).toBe('ALIVE');
    expect(await abilityOf(sniper!, 'sniper_shot')).toMatchObject({ status: 'EXHAUSTED', charges_remaining: 0 });
    const { rows } = await db.pool.query<{ status: string }>(`select status from night_actions where player_id = $1 and phase = 'DAY_DISCUSSION'`, [sniper!.playerId]);
    expect(rows.map((r) => r.status)).toEqual(['RESOLVED']);
  });

  it('kills by day, before voting, and ends the game when it removes the last wolf', async () => {
    const { host, seats } = await classicWithSniper();
    const [sniper] = await seatsOf(host.gameId, seats, 'sniper');
    const [wolfA, wolfB] = await seatsOf(host.gameId, seats, 'pack_wolf');

    // Day 1: the table votes one wolf out.
    await closeUntil(host, 'VOTING');
    for (const seat of seats.filter((s) => s.playerId !== wolfA!.playerId)) await vote(seat, wolfA!);
    await close(host);
    expect(await life(wolfA!)).toBe('DEAD');

    // Day 2: the Sniper shoots the other wolf. The game ends without opening voting.
    await closeUntil(host, 'DAY_DISCUSSION');
    await act(sniper!, 'sniper_shot', wolfB!);
    expect(await close(host)).toMatchObject({ status: 'FINISHED', phase: 'FINISHED', roundNumber: 2 });

    const { rows } = await db.pool.query<{ phase_kind: string; causes: { type: string; via: string; actorIds: string[] }[] }>(
      `select phase_kind, causes from elimination_records where player_id = $1`,
      [wolfB!.playerId],
    );
    expect(rows[0]).toEqual({ phase_kind: 'DAY', causes: [{ type: 'SNIPER', via: 'ABILITY', actorIds: [sniper!.playerId] }] });
    const results = (await api().get(`/api/v1/games/${host.gameId}/results`).set(bearer(seats[3]!)).expect(200)).body as { winningTeam: string };
    expect(results.winningTeam).toBe('VILLAGE');
  });
});

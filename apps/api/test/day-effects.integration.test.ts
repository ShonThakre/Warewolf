import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  configurationResponseSchema,
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
 * Day-close effects that share DayResolutionService with voting: Immortal
 * spends a charge to survive a day vote, and delayed poison lands on the
 * due day.
 */

let db: TestDatabase;
let app: INestApplication;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

async function classicWith(extra: { roleId: string; count?: number }[]): Promise<{ host: SeatCredentials; seats: SeatCredentials[] }> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  const seats = [host];
  for (let i = 2; i <= 10; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  const { draft } = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body);
  let villagers = draft.roles.find((entry) => entry.roleId === 'normal_villager')!.count;
  const roles = draft.roles.map((entry) => {
    if (entry.roleId !== 'normal_villager') return entry;
    villagers -= extra.reduce((n, item) => n + (item.count ?? 1), 0);
    return { ...entry, count: villagers };
  });
  await api()
    .put(`/api/v1/games/${host.gameId}/configuration`)
    .set(bearer(host))
    .send({ ...draft, roles: [...roles, ...extra.map((item) => ({ roleId: item.roleId, count: item.count ?? 1, ...(item.roleId === 'poisoner' ? { faction: 'NEUTRAL' as const } : {}) }))] })
    .expect(200);
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
    if (i > 16) throw new Error(`never reached ${phase}, stuck on ${current.phase}`);
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

const act = async (seat: SeatCredentials, abilityId: string, target: SeatCredentials) =>
  api()
    .post(`/api/v1/games/${seat.gameId}/actions`)
    .set(bearer(seat))
    .set('Idempotency-Key', randomUUID())
    .send({ abilityInstanceId: (await abilityOf(seat, abilityId)).id, targetPlayerIds: [target.playerId] })
    .expect(200);

const life = async (seat: SeatCredentials) =>
  (await db.pool.query<{ life_status: string }>(`select life_status from game_players where id = $1`, [seat.playerId])).rows[0]!.life_status;

const vote = (seat: SeatCredentials, target: SeatCredentials) =>
  api().post(`/api/v1/games/${seat.gameId}/votes`).set(bearer(seat)).send({ targetPlayerId: target.playerId }).expect(200);

describe('day effects', () => {
  it('lets Immortal spend a charge and stay alive when voted out', async () => {
    const { host, seats } = await classicWith([{ roleId: 'immortal' }]);
    const [immortal] = await seatsOf(host.gameId, seats, 'immortal');

    await closeUntil(host, 'VOTING');
    for (const seat of seats.filter((s) => s.playerId !== immortal!.playerId)) await vote(seat, immortal!);
    expect(await close(host)).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });

    expect(await life(immortal!)).toBe('ALIVE');
    expect(await abilityOf(immortal!, 'immortal_survive')).toMatchObject({ status: 'EXHAUSTED', charges_remaining: 0 });
    const { rows } = await db.pool.query(`select id from elimination_records where player_id = $1`, [immortal!.playerId]);
    expect(rows).toEqual([]);
  });

  it('lands the Poisoner’s delayed poison when that day’s ballot closes', async () => {
    const { host, seats } = await classicWith([{ roleId: 'poisoner' }]);
    const [poisoner] = await seatsOf(host.gameId, seats, 'poisoner');
    const [victim] = (await seatsOf(host.gameId, seats, 'normal_villager')).filter((s) => s.playerId !== host.playerId);
    const [wolf] = await seatsOf(host.gameId, seats, 'pack_wolf');

    await closeUntil(host, 'NIGHT_SUBMIT');
    await act(poisoner!, 'poisoner_poison', victim!);
    await closeUntil(host, 'VOTING');
    expect(await life(victim!)).toBe('ALIVE');

    // END_OF_NEXT_DAY_RESOLUTION is due this round's DAY close (after the night that scheduled it).
    for (const seat of seats.filter((s) => s.playerId !== wolf!.playerId)) await vote(seat, wolf!);
    await close(host);

    expect(await life(victim!)).toBe('DEAD');
    const { rows } = await db.pool.query<{ phase_kind: string; causes: { type: string }[] }>(
      `select phase_kind, causes from elimination_records where player_id = $1`,
      [victim!.playerId],
    );
    expect(rows[0]?.phase_kind).toBe('DAY');
    expect(rows[0]?.causes[0]?.type).toBe('POISON');
  });
});

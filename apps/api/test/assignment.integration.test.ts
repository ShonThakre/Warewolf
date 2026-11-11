import type { INestApplication } from '@nestjs/common';
import {
  configurationResponseSchema,
  errorBodySchema,
  hostRosterSchema,
  lobbyProjectionSchema,
  myRoleSchema,
  parseGameConfiguration,
  seatCredentialsSchema,
  startGameResponseSchema,
  type SeatCredentials,
} from '@warewolf/contracts';
import { DEFAULT_CATALOG, dealRoles, getPack, type RandomInt } from '@warewolf/domain';
import { drizzle } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changeAssignment, type AssignmentChange } from '../src/assignment/assignment.repository.js';
import { cryptoRandomInt } from '../src/assignment/start.service.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import * as schema from '../src/db/schema.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

let db: TestDatabase;
let app: INestApplication;
/** The deal's random source. Tests swap it for a scripted one and put the CSPRNG back. */
let nextRandom: RandomInt = cryptoRandomInt;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const errorCode = (body: unknown) => errorBodySchema.parse(body).error.code;

async function create(mode = 'INFECTION', displayName = 'Host'): Promise<SeatCredentials> {
  const res = await api().post('/api/v1/games').send({ displayName, mode }).expect(201);
  return seatCredentialsSchema.parse(res.body);
}

/** Creates a room and fills every seat. Returns the seats in seat order, host first. */
async function fullRoom(mode: string, players: number): Promise<SeatCredentials[]> {
  const host = await create(mode);
  const seats = [host];
  for (let i = 2; i <= players; i++) {
    const res = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(res.body));
  }
  return seats;
}

const start = (seat: SeatCredentials, body: object = {}) => api().post(`/api/v1/games/${seat.gameId}/start`).set(bearer(seat)).send(body);
const me = (seat: SeatCredentials) => api().get(`/api/v1/games/${seat.gameId}/me`).set(bearer(seat));
const roster = (seat: SeatCredentials) => api().get(`/api/v1/games/${seat.gameId}/host/roster`).set(bearer(seat));

async function dealtRoles(gameId: string): Promise<Map<string, { original: string; current: string; faction: string }>> {
  const { rows } = await db.pool.query<{ player_id: string; original_role_id: string; current_role_id: string; current_faction: string }>(
    `select player_id, original_role_id, current_role_id, current_faction from role_assignments where game_id = $1`,
    [gameId],
  );
  return new Map(rows.map((r) => [r.player_id, { original: r.original_role_id, current: r.current_role_id, faction: r.current_faction }]));
}

async function gameRow(gameId: string) {
  const { rows } = await db.pool.query(`select status, phase, round_number, state_version, config_snapshot, config_draft, catalog_hash from games where id = $1`, [gameId]);
  return rows[0];
}

const countValues = (values: Iterable<string>) => {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
};

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false, overrides: { dealRandom: (max) => nextRandom(max) } });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

describe('POST /games/:gameId/start', () => {
  it('deals a full 20-player Infection Edition with the exact pack counts', async () => {
    const seats = await fullRoom('INFECTION', 20);
    const host = seats[0]!;
    const lobbyBefore = lobbyProjectionSchema.parse((await api().get(`/api/v1/games/${host.gameId}`).set(bearer(host)).expect(200)).body);
    expect(lobbyBefore.start).toEqual({ ready: true, blockers: [], requiresWarningAcknowledgement: false });
    const draft = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body).draft;

    const res = await start(host).expect(200);
    expect(startGameResponseSchema.parse(res.body)).toEqual({
      gameId: host.gameId,
      status: 'ACTIVE',
      phase: 'ROLE_REVEAL',
      roundNumber: 1,
      stateVersion: lobbyBefore.stateVersion + 1,
    });

    const roles = await dealtRoles(host.gameId);
    expect([...roles.keys()].sort()).toEqual(seats.map((s) => s.playerId).sort());
    expect(countValues([...roles.values()].map((r) => r.original))).toEqual({
      alpha_wolf: 1,
      seeker: 2,
      guard: 1,
      doctor: 1,
      witch: 1,
      normal_villager: 14,
    });
    for (const r of roles.values()) expect(r.current).toBe(r.original);

    const { rows: abilities } = await db.pool.query<{ ability_id: string; n: number }>(
      `select ability_id, count(*)::int as n from ability_instances where game_id = $1 group by ability_id`,
      [host.gameId],
    );
    const expectedAbilities = countValues(dealRoles(parseGameConfiguration(draft), seats.map((s) => s.playerId), cryptoRandomInt).flatMap((d) => d.abilities.map((a) => a.abilityId)));
    expect(Object.fromEntries(abilities.map((a) => [a.ability_id, a.n]))).toEqual(expectedAbilities);

    expect(await gameRow(host.gameId)).toMatchObject({
      status: 'ACTIVE',
      phase: 'ROLE_REVEAL',
      round_number: 1,
      config_snapshot: draft,
      catalog_hash: DEFAULT_CATALOG.hash,
    });
  });

  it('writes exactly the deal the domain produces from the injected random source', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const script = (): RandomInt => {
      let k = 0;
      return (max) => (k++ * 7) % max;
    };
    nextRandom = script();
    try {
      await start(seats[0]!, { acknowledgeWarnings: true }).expect(200);
    } finally {
      nextRandom = cryptoRandomInt;
    }
    const expected = dealRoles(getPack('classic-10')!.config, seats.map((s) => s.playerId), script());
    const roles = await dealtRoles(seats[0]!.gameId);
    expect(seats.map((s) => roles.get(s.playerId)!.original)).toEqual(expected.map((d) => d.roleId));
  });

  it('lets only the host start', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const res = await start(seats[1]!, { acknowledgeWarnings: true }).expect(403);
    expect(errorCode(res.body)).toBe('NOT_HOST');
    expect((await gameRow(seats[0]!.gameId))!.status).toBe('LOBBY');
  });

  it('refuses a room with open seats and writes nothing', async () => {
    const host = await create('CLASSIC');
    const res = await start(host, { acknowledgeWarnings: true }).expect(409);
    expect(errorCode(res.body)).toBe('SEAT_COUNT_MISMATCH');
    expect((await dealtRoles(host.gameId)).size).toBe(0);
    expect((await gameRow(host.gameId))!.status).toBe('LOBBY');
  });

  it('validates the saved draft again and refuses an invalid one', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const host = seats[0]!;
    const { draft } = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host))).body);
    await api()
      .put(`/api/v1/games/${host.gameId}/configuration`)
      .set(bearer(host))
      .send({ ...draft, roles: draft.roles.map((e) => (e.roleId === 'normal_villager' ? { ...e, count: e.count - 1 } : e)) })
      .expect(200);

    const res = await start(host, { acknowledgeWarnings: true }).expect(422);
    expect(errorCode(res.body)).toBe('CONFIG_INVALID');
    expect((await gameRow(host.gameId))!.status).toBe('LOBBY');
  });

  it('requires the host to acknowledge warnings when the draft has them', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const host = seats[0]!;
    expect(errorCode((await start(host).expect(422)).body)).toBe('WARNINGS_UNACKNOWLEDGED');
    expect(errorCode((await start(host, { acknowledgeWarnings: false }).expect(422)).body)).toBe('WARNINGS_UNACKNOWLEDGED');
    await start(host, { acknowledgeWarnings: true }).expect(200);
  });

  it('does not accept a seed or any other field from the client', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const res = await start(seats[0]!, { acknowledgeWarnings: true, seed: 1234 }).expect(422);
    expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
    expect((await gameRow(seats[0]!.gameId))!.status).toBe('LOBBY');
  });

  it('starts a game once', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    await start(seats[0]!, { acknowledgeWarnings: true }).expect(200);
    expect(errorCode((await start(seats[0]!, { acknowledgeWarnings: true }).expect(409)).body)).toBe('GAME_STARTED');
  });

  it('deals once when two start requests race', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const results = await Promise.all([start(seats[0]!, { acknowledgeWarnings: true }), start(seats[0]!, { acknowledgeWarnings: true })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const { rows } = await db.pool.query(`select count(*)::int as n from role_assignments where game_id = $1`, [seats[0]!.gameId]);
    expect(rows[0]).toEqual({ n: 10 });
  });

  it('closes the lobby, and the lobby projection still names no role', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    const [host, guest] = seats as [SeatCredentials, SeatCredentials];
    await start(host, { acknowledgeWarnings: true }).expect(200);

    const view = await api().get(`/api/v1/games/${host.gameId}`).set(bearer(guest)).expect(200);
    expect(lobbyProjectionSchema.parse(view.body)).toMatchObject({ status: 'ACTIVE', phase: 'ROLE_REVEAL', start: { ready: false, blockers: ['NOT_LOBBY'] } });
    for (const roleId of ['pack_wolf', 'seeker', 'doctor', 'normal_villager']) expect(JSON.stringify(view.body)).not.toContain(`"${roleId}"`);

    expect(errorCode((await api().post(`/api/v1/games/${host.gameId}/leave`).set(bearer(guest)).send({}).expect(409)).body)).toBe('GAME_STARTED');
    expect(errorCode((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(409)).body)).toBe('GAME_STARTED');
  });

  it('answers 401 without a token and 404 for a token from another game', async () => {
    const a = await create('CLASSIC', 'Alpha');
    const b = await create('CLASSIC', 'Bravo');
    expect(errorCode((await api().post(`/api/v1/games/${a.gameId}/start`).send({}).expect(401)).body)).toBe('UNAUTHENTICATED');
    for (const path of ['start', 'me', 'host/roster']) {
      const req = path === 'start' ? api().post(`/api/v1/games/${b.gameId}/${path}`).send({}) : api().get(`/api/v1/games/${b.gameId}/${path}`);
      expect(errorCode((await req.set(bearer(a)).expect(404)).body)).toBe('NOT_FOUND');
    }
  });
});

describe('GET /games/:gameId/me', () => {
  it('is not available before the deal', async () => {
    const host = await create();
    expect(errorCode((await me(host).expect(409)).body)).toBe('PHASE_CONFLICT');
  });

  it('gives every seat its own role and no other role id', async () => {
    const seats = await fullRoom('INFECTION', 20);
    await start(seats[0]!).expect(200);
    const roles = await dealtRoles(seats[0]!.gameId);
    const inGame = new Set([...roles.values()].map((r) => r.original));

    for (const seat of seats) {
      const res = await me(seat).expect(200);
      const view = myRoleSchema.parse(res.body);
      const own = roles.get(seat.playerId)!;
      expect(view).toMatchObject({
        gameId: seat.gameId,
        playerId: seat.playerId,
        lifeStatus: 'ALIVE',
        originalRole: { id: own.original },
        currentRole: { id: own.current },
        teammatesVisible: false,
        teammates: [],
      });
      const json = JSON.stringify(res.body);
      const leaked = [...inGame].filter((id) => id !== own.original && json.includes(`"${id}"`));
      expect(leaked, `seat ${seat.playerId} (${own.original})`).toEqual([]);
    }
  });

  it('shows Classic Pack Wolves each other, without roles', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    await start(seats[0]!, { acknowledgeWarnings: true }).expect(200);
    const roles = await dealtRoles(seats[0]!.gameId);
    const wolves = seats.filter((s) => roles.get(s.playerId)!.original === 'pack_wolf');
    expect(wolves).toHaveLength(2);

    const [a, b] = wolves as [SeatCredentials, SeatCredentials];
    const view = myRoleSchema.parse((await me(a).expect(200)).body);
    expect(view.teammatesVisible).toBe(true);
    expect(view.teammates.map((t) => t.playerId)).toEqual([b.playerId]);
    expect(Object.keys(view.teammates[0]!).sort()).toEqual(['displayName', 'playerId', 'seatNumber']);

    const villager = seats.find((s) => roles.get(s.playerId)!.original === 'normal_villager')!;
    expect(myRoleSchema.parse((await me(villager).expect(200)).body)).toMatchObject({ teammatesVisible: false, teammates: [] });
  });

  it('shows a conversion as a new current role over the unchanged original', async () => {
    const seats = await fullRoom('INFECTION', 20);
    await start(seats[0]!).expect(200);
    const roles = await dealtRoles(seats[0]!.gameId);
    const seekerSeat = seats.find((s) => roles.get(s.playerId)!.original === 'seeker')!;
    const { rows } = await db.pool.query<{ id: string }>(`select id from role_assignments where player_id = $1`, [seekerSeat.playerId]);

    // A caller that slips an original field past the type: the repository drops it instead of writing it.
    const change = {
      currentRoleId: 'infected_wolf',
      currentProfileId: 'infected_wolf',
      currentFaction: 'WOLF_PACK',
      wolfAligned: true,
      originalRoleId: 'alpha_wolf',
      originalFaction: 'WOLF_PACK',
    } as AssignmentChange;
    await changeAssignment(drizzle(db.pool, { schema }), rows[0]!.id, change);

    const view = myRoleSchema.parse((await me(seekerSeat).expect(200)).body);
    expect(view.originalRole).toEqual({ id: 'seeker', profileId: 'seeker', name: 'Seeker', faction: 'VILLAGE' });
    expect(view.currentRole).toEqual({ id: 'infected_wolf', profileId: 'infected_wolf', name: 'Infected Wolf', faction: 'WOLF_PACK' });
  });
});

describe('GET /games/:gameId/host/roster', () => {
  it('is for the host only, and only after the deal', async () => {
    const seats = await fullRoom('CLASSIC', 10);
    expect(errorCode((await roster(seats[0]!).expect(409)).body)).toBe('PHASE_CONFLICT');
    expect(errorCode((await roster(seats[1]!).expect(403)).body)).toBe('NOT_HOST');
    await start(seats[0]!, { acknowledgeWarnings: true }).expect(200);
    expect(errorCode((await roster(seats[1]!).expect(403)).body)).toBe('NOT_HOST');
  });

  it('lists every seat with the role it was dealt', async () => {
    const seats = await fullRoom('INFECTION', 20);
    await start(seats[0]!).expect(200);
    const roles = await dealtRoles(seats[0]!.gameId);

    const view = hostRosterSchema.parse((await roster(seats[0]!).expect(200)).body);
    expect(view).toMatchObject({ gameId: seats[0]!.gameId, phase: 'ROLE_REVEAL', roundNumber: 1 });
    expect(view.players.map((p) => p.playerId)).toEqual(seats.map((s) => s.playerId));
    for (const p of view.players) expect(p.originalRoleId).toBe(roles.get(p.playerId)!.original);
    expect(view.players.find((p) => p.originalRoleId === 'alpha_wolf')).toMatchObject({ wolfAligned: true, currentFaction: 'WOLF_PACK' });
  });
});

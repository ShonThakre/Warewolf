import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { errorBodySchema, gameStateSchema, hostDashboardSchema, seatCredentialsSchema, type GameState, type HostDashboard, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1202a: one host-only payload with the round's submissions, every
 * infection attempt, every ballot with its voters, and every death with its
 * causes. Played through the real Infection Edition resolvers.
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

async function lobby(): Promise<{ host: SeatCredentials; seats: SeatCredentials[] }> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'INFECTION' }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  const seats = [host];
  for (let i = 2; i <= 20; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  return { host, seats };
}

async function state(seat: SeatCredentials): Promise<GameState> {
  return gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat)).expect(200)).body);
}

async function close(host: SeatCredentials): Promise<GameState> {
  const current = await state(host);
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

const dashboard = (seat: SeatCredentials) => api().get(`/api/v1/games/${seat.gameId}/host/dashboard`).set(bearer(seat));
const read = async (host: SeatCredentials): Promise<HostDashboard> => hostDashboardSchema.parse((await dashboard(host).expect(200)).body);

async function seatOf(gameId: string, seats: SeatCredentials[], roleId: string): Promise<SeatCredentials[]> {
  const { rows } = await db.pool.query<{ player_id: string }>(
    `select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id`,
    [gameId, roleId],
  );
  return rows.map((r) => seats.find((s) => s.playerId === r.player_id)!);
}

async function ability(seat: SeatCredentials, abilityId: string): Promise<string> {
  const { rows } = await db.pool.query<{ id: string }>(`select id from ability_instances where player_id = $1 and ability_id = $2`, [seat.playerId, abilityId]);
  return rows[0]!.id;
}

async function act(seat: SeatCredentials, abilityId: string, target: SeatCredentials) {
  await api()
    .post(`/api/v1/games/${seat.gameId}/actions`)
    .set(bearer(seat))
    .set('Idempotency-Key', randomUUID())
    .send({ abilityInstanceId: await ability(seat, abilityId), targetPlayerIds: [target.playerId] })
    .expect(200);
}

describe('GET /games/:gameId/host/dashboard', () => {
  it('is the host’s alone, and only once roles are dealt', async () => {
    const { host, seats } = await lobby();
    expect(errorCode((await dashboard(host).expect(409)).body)).toBe('PHASE_CONFLICT');
    await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
    expect(errorCode((await dashboard(seats[4]!).expect(403)).body)).toBe('NOT_HOST');
    await dashboard({ ...host, gameId: randomUUID() }).expect(404);

    const first = await read(host);
    expect(first.overview).toMatchObject({ status: 'ACTIVE', phase: 'ROLE_REVEAL', roundNumber: 1, alive: 20, wolfAlignedAlive: 1 });
    expect(first.overview.infection).toEqual({ enabled: true, successes: 0, max: 4, sealed: false });
    expect(first.roster.players).toHaveLength(20);
    expect(first).toMatchObject({ submissions: [], infections: [], ballots: [], eliminations: [], victory: { outcome: null, individuals: [] } });
  });

  it('shows the night’s submissions, the infection, the ballot with its voters, and the deaths with their causes', async () => {
    const { host, seats } = await lobby();
    await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
    const [alpha] = await seatOf(host.gameId, seats, 'alpha_wolf');
    const villagers = (await seatOf(host.gameId, seats, 'normal_villager')).filter((s) => s.playerId !== host.playerId);
    const [infectTarget, killTarget, voteTarget] = villagers;

    await closeUntil(host, 'NIGHT_SUBMIT');
    await act(alpha!, 'alpha_infect', infectTarget!);
    await act(alpha!, 'alpha_kill', killTarget!);

    const night = await read(host);
    expect(night.submissions.map((s) => [s.playerId, s.abilityId, s.targetPlayerIds, s.status]).sort()).toEqual(
      [
        [alpha!.playerId, 'alpha_infect', [infectTarget!.playerId], 'PENDING'],
        [alpha!.playerId, 'alpha_kill', [killTarget!.playerId], 'PENDING'],
      ].sort(),
    );

    await closeUntil(host, 'NIGHT_HOST_CONFIRM');
    await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ targetPlayerId: killTarget!.playerId }).expect(200);
    await closeUntil(host, 'VOTING');

    const day = await read(host);
    expect(day.overview).toMatchObject({ phase: 'VOTING', alive: 19, wolfAlignedAlive: 2 });
    expect(day.overview.infection.successes).toBe(1);
    expect(day.infections).toEqual([{ roundNumber: 1, sourcePlayerId: alpha!.playerId, targetPlayerId: infectTarget!.playerId, outcome: 'SUCCESS', failureReason: null }]);
    expect(day.eliminations).toHaveLength(1);
    expect(day.eliminations[0]).toMatchObject({ roundNumber: 1, phaseKind: 'NIGHT', playerId: killTarget!.playerId, roleAtDeath: 'normal_villager' });
    expect(day.eliminations[0]!.causes[0]).toMatchObject({ type: 'WOLF_KILL', actorIds: [alpha!.playerId] });
    expect(day.roster.players.find((p) => p.playerId === infectTarget!.playerId)).toMatchObject({ originalFaction: 'VILLAGE', currentFaction: 'WOLF_PACK' });

    // Three living seats vote; the dead seat cannot.
    const living = seats.filter((s) => s.playerId !== killTarget!.playerId && s.playerId !== voteTarget!.playerId).slice(0, 3);
    for (const voter of living) {
      await api().post(`/api/v1/games/${host.gameId}/votes`).set(bearer(voter)).send({ targetPlayerId: voteTarget!.playerId }).expect(200);
    }
    const ballot = (await read(host)).ballots;
    expect(ballot).toHaveLength(1);
    expect(ballot[0]).toMatchObject({ roundNumber: 1, ballot: 1, open: true });
    expect(ballot[0]!.votes.map((v) => v.voterPlayerId).sort()).toEqual(living.map((s) => s.playerId).sort());
    expect(ballot[0]!.counts).toEqual([{ targetPlayerId: voteTarget!.playerId, total: 3 }]);

    await close(host);
    const after = await read(host);
    expect(after.ballots[0]).toMatchObject({ open: false, counts: [{ targetPlayerId: voteTarget!.playerId, total: 3 }] });
    expect(after.eliminations.map((e) => [e.playerId, e.phaseKind])).toEqual([
      [killTarget!.playerId, 'NIGHT'],
      [voteTarget!.playerId, 'DAY'],
    ]);
    expect(after.eliminations[1]!.causes[0]!.actorIds.sort()).toEqual(living.map((s) => s.playerId).sort());
    // A new round starts with no submissions of its own.
    expect(after.overview).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });
    expect(after.submissions).toEqual([]);
  });
});

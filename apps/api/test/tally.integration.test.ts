import type { INestApplication } from '@nestjs/common';
import { dayTalliesResponseSchema, gameEventsResponseSchema, gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { EventService } from '../src/events/event.service.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-904, OD-85: after a ballot closes every seat sees the counts per
 * target, abstentions, and who was named, and never who voted for whom.
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

const vote = (seat: SeatCredentials, target: SeatCredentials | null) =>
  api().post(`/api/v1/games/${seat.gameId}/votes`).set(bearer(seat)).send({ targetPlayerId: target?.playerId ?? null }).expect(200);
const tallies = async (seat: SeatCredentials) => dayTalliesResponseSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/tallies`).set(bearer(seat)).expect(200)).body).tallies;

describe('public tally (OD-85)', () => {
  it('publishes counts, abstentions, and the named player when the ballot closes, and no voter', async () => {
    const { host, seats } = await classic();
    const [, a, b, c, d, e, f, x, y] = seats;
    await closeUntil(host, 'VOTING');

    await vote(a!, x!);
    await vote(b!, x!);
    await vote(c!, y!);
    await vote(d!, x!);
    await vote(e!, y!);
    await vote(f!, null);
    // Votes can change until the close, so nothing is public yet.
    expect(await tallies(a!)).toEqual([]);

    await close(host);
    const [tally] = await tallies(seats[9]!);
    expect(tally).toEqual({
      roundNumber: 1,
      ballot: 1,
      counts: [
        { targetPlayerId: x!.playerId, total: 3 },
        { targetPlayerId: y!.playerId, total: 2 },
      ],
      abstentions: 1,
      votedOutPlayerId: x!.playerId,
      tiedPlayerIds: [],
    });

    const raw = JSON.stringify((await api().get(`/api/v1/games/${host.gameId}/tallies`).set(bearer(a!)).expect(200)).body);
    for (const voter of [a, b, c, d, e, f]) expect(raw).not.toContain(voter!.playerId);

    // The same tally reaches every seat as a public event, once.
    const events = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events?afterSeq=0`).set(bearer(c!)).expect(200)).body).events;
    const published = events.filter((ev) => ev.type === 'VOTE_TALLY');
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ audience: 'PUBLIC', payload: tally });
    expect(await app.get(EventService).publishTallies(host.gameId, 1)).toEqual([]);
  });

  it('publishes a first-ballot tie and then the revote', async () => {
    const { host, seats } = await classic();
    const [, a, b, c, d, x, y] = seats;
    await closeUntil(host, 'VOTING');
    await vote(a!, x!);
    await vote(b!, x!);
    await vote(c!, y!);
    await vote(d!, y!);
    expect(await close(host)).toMatchObject({ phase: 'REVOTE' });

    const first = (await tallies(a!))[0]!;
    expect(first.votedOutPlayerId).toBeNull();
    expect([...first.tiedPlayerIds].sort()).toEqual([x!.playerId, y!.playerId].sort());

    await vote(a!, y!);
    await vote(b!, y!);
    await vote(c!, y!);
    await close(host);
    const both = await tallies(a!);
    expect(both.map((t) => t.ballot)).toEqual([1, 2]);
    expect(both[1]).toMatchObject({ roundNumber: 1, counts: [{ targetPlayerId: y!.playerId, total: 3 }], abstentions: 0, votedOutPlayerId: y!.playerId });
  });
});

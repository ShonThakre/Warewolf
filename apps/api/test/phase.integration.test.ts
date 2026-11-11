import type { INestApplication } from '@nestjs/common';
import { errorBodySchema, gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import { DEFAULT_CATALOG, type Ballot, type DayResolution, type NightResolution } from '@warewolf/domain';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { PhaseResolvers } from '../src/phase/resolution.js';
import type { Clock, PhaseScheduler } from '../src/phase/timing.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/** Records deadlines instead of waiting for them. `fire` runs one as the timer would. */
class ManualScheduler implements PhaseScheduler {
  readonly entries = new Map<string, { at: Date; task: () => Promise<void> }>();

  schedule(gameId: string, at: Date, task: () => Promise<void>): void {
    this.entries.set(gameId, { at, task });
  }

  cancel(gameId: string): void {
    this.entries.delete(gameId);
  }

  at(gameId: string): string | null {
    return this.entries.get(gameId)?.at.toISOString() ?? null;
  }

  async fire(gameId: string): Promise<void> {
    const entry = this.entries.get(gameId);
    if (!entry) throw new Error(`nothing scheduled for ${gameId}`);
    this.entries.delete(gameId);
    await entry.task();
  }
}

const T0 = new Date('2026-11-11T20:00:00.000Z');
let now = new Date(T0);
const clock: Clock = { now: () => new Date(now) };
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000).toISOString();
const advance = (seconds: number) => {
  now = new Date(now.getTime() + seconds * 1000);
};

const scheduler = new ManualScheduler();

/** What the stand-in resolvers report, and every call they received. */
let night: NightResolution;
let day: DayResolution;
let failNight: boolean;
let calls: string[];
const resolvers: PhaseResolvers = {
  async resolveNight(_tx, game) {
    calls.push(`night:${game.roundNumber}`);
    if (failNight) throw new Error('resolver failed');
    return night;
  },
  async resolveDay(_tx, game, ballot: Ballot) {
    calls.push(`day:${game.roundNumber}:${ballot}`);
    return day;
  },
};

let db: TestDatabase;
let app: INestApplication;

const api = (target: INestApplication = app) => request(target.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const errorCode = (body: unknown) => errorBodySchema.parse(body).error.code;

async function fullRoom(mode: 'INFECTION' | 'CLASSIC', players: number, target = app): Promise<SeatCredentials[]> {
  const res = await api(target).post('/api/v1/games').send({ displayName: 'Host', mode }).expect(201);
  const host = seatCredentialsSchema.parse(res.body);
  const seats = [host];
  for (let i = 2; i <= players; i++) {
    const joined = await api(target).post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  return seats;
}

/** A started game: Infection Edition is 20 seats and host-paced, Classic is 10 seats and timed. */
async function startedGame(mode: 'INFECTION' | 'CLASSIC', target = app): Promise<SeatCredentials[]> {
  const seats = await fullRoom(mode, mode === 'INFECTION' ? 20 : 10, target);
  await api(target).post(`/api/v1/games/${seats[0]!.gameId}/start`).set(bearer(seats[0]!)).send({ acknowledgeWarnings: true }).expect(200);
  return seats;
}

const getState = (seat: SeatCredentials) => api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat));
const closeRaw = (seat: SeatCredentials, body: object) => api().post(`/api/v1/games/${seat.gameId}/host/phase/close`).set(bearer(seat)).send(body);

async function state(seat: SeatCredentials): Promise<GameState> {
  return gameStateSchema.parse((await getState(seat).expect(200)).body);
}

/** Closes the current phase as the host, with the version the host's screen shows. */
/** Host confirm needs a choice before it closes (WW-803). Chooses no kill unless the test already chose. */
async function ensureKillDecision(host: SeatCredentials): Promise<void> {
  const view = await api().get(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).expect(200);
  if ((view.body as { decision: unknown }).decision === null) {
    await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ noKill: true }).expect(200);
  }
}

async function close(host: SeatCredentials): Promise<GameState> {
  const current = await state(host);
  if (current.phase === 'NIGHT_HOST_CONFIRM') await ensureKillDecision(host);
  const res = await closeRaw(host, { stateVersion: current.stateVersion }).expect(200);
  return gameStateSchema.parse(res.body);
}

async function closeUntil(host: SeatCredentials, phase: GameState['phase']): Promise<GameState> {
  let current = await state(host);
  for (let i = 0; current.phase !== phase; i++) {
    if (i > 10) throw new Error(`never reached ${phase}`);
    current = await close(host);
  }
  return current;
}

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false, overrides: { clock, scheduler, resolvers } });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

beforeEach(() => {
  now = new Date(T0);
  night = { gameOver: false };
  day = { gameOver: false, tied: false };
  failNight = false;
  calls = [];
});

describe('GET /games/:gameId/state', () => {
  it('shows a lobby in round 0 with nothing to close', async () => {
    const [host] = await fullRoom('INFECTION', 1);
    expect(await state(host!)).toMatchObject({
      status: 'LOBBY',
      phase: 'LOBBY',
      roundNumber: 0,
      pacing: 'HOST',
      phaseEndsAt: null,
      serverNow: T0.toISOString(),
      close: null,
      you: { playerId: host!.playerId, isHost: true, lifeStatus: 'ALIVE' },
    });
  });

  it('gives every seat the same public facts and no roles', async () => {
    const seats = await startedGame('INFECTION');
    const guest = seats[5]!;
    const res = await getState(guest).expect(200);
    const view = gameStateSchema.parse(res.body);
    expect(view).toMatchObject({ status: 'ACTIVE', phase: 'ROLE_REVEAL', roundNumber: 1, you: { playerId: guest.playerId, isHost: false } });
    expect(view.players.map((p) => p.seatNumber)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    const raw = JSON.stringify(res.body);
    for (const role of DEFAULT_CATALOG.roles) expect(raw).not.toContain(`"${role.id}"`);
    expect(Object.keys(res.body).sort()).toEqual(Object.keys(view).sort());

    const hostView = await state(seats[0]!);
    expect({ ...hostView, you: null }).toEqual({ ...view, you: null });
  });

  it('is 401 without a token and 404 with a token from another game', async () => {
    const [a] = await fullRoom('CLASSIC', 1);
    const [b] = await fullRoom('CLASSIC', 1);
    await api().get(`/api/v1/games/${a!.gameId}/state`).expect(401);
    const res = await api().get(`/api/v1/games/${a!.gameId}/state`).set(bearer(b!)).expect(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
  });
});

describe('Infection Edition, host-paced (WW-501, WW-503)', () => {
  it('opens host confirm and the Doctor reaction every night, and moves one phase per close', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    const start = await state(host);
    expect(start).toMatchObject({ phase: 'ROLE_REVEAL', pacing: 'HOST', close: { next: 'NIGHT_SUBMIT', resolves: null } });

    const steps: Pick<GameState, 'phase' | 'roundNumber' | 'close' | 'phaseEndsAt'>[] = [];
    let version = start.stateVersion;
    for (let i = 0; i < 7; i++) {
      const next = await close(host);
      expect(next.stateVersion).toBe(++version);
      steps.push({ phase: next.phase, roundNumber: next.roundNumber, close: next.close, phaseEndsAt: next.phaseEndsAt });
    }

    expect(steps).toEqual([
      { phase: 'NIGHT_SUBMIT', roundNumber: 1, close: { next: 'NIGHT_HOST_CONFIRM', resolves: null }, phaseEndsAt: null },
      { phase: 'NIGHT_HOST_CONFIRM', roundNumber: 1, close: { next: 'NIGHT_REACTION', resolves: null }, phaseEndsAt: null },
      { phase: 'NIGHT_REACTION', roundNumber: 1, close: { next: null, resolves: 'NIGHT' }, phaseEndsAt: null },
      { phase: 'DAY_ANNOUNCE', roundNumber: 1, close: { next: 'DAY_DISCUSSION', resolves: null }, phaseEndsAt: null },
      { phase: 'DAY_DISCUSSION', roundNumber: 1, close: { next: 'VOTING', resolves: null }, phaseEndsAt: null },
      { phase: 'VOTING', roundNumber: 1, close: { next: null, resolves: 'DAY' }, phaseEndsAt: null },
      { phase: 'NIGHT_SUBMIT', roundNumber: 2, close: { next: 'NIGHT_HOST_CONFIRM', resolves: null }, phaseEndsAt: null },
    ]);
    expect(calls).toEqual(['night:1', 'day:1:FIRST']);
    expect(scheduler.at(host.gameId)).toBeNull();
  });

  it('opens the reaction window even after the Doctor is dead', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    await db.pool.query(
      `update game_players set life_status = 'DEAD', died_round = 1
       where id = (select player_id from role_assignments where game_id = $1 and original_role_id = 'doctor')`,
      [host.gameId],
    );
    await closeUntil(host, 'NIGHT_HOST_CONFIRM');
    expect((await close(host)).phase).toBe('NIGHT_REACTION');
  });

  it('checks the host, then the phase, then the version', async () => {
    const seats = await startedGame('INFECTION');
    const [host, guest] = [seats[0]!, seats[1]!];
    const { stateVersion } = await state(host);

    expect(errorCode((await closeRaw(guest, { stateVersion }).expect(403)).body)).toBe('NOT_HOST');
    expect(errorCode((await closeRaw(host, { stateVersion: stateVersion - 1 }).expect(409)).body)).toBe('PHASE_CONFLICT');
    expect(errorCode((await closeRaw(host, { stateVersion: stateVersion + 1 }).expect(409)).body)).toBe('PHASE_CONFLICT');
    expect(errorCode((await closeRaw(host, {}).expect(422)).body)).toBe('VALIDATION_FAILED');
    expect(errorCode((await closeRaw(host, { stateVersion, phase: 'FINISHED' }).expect(422)).body)).toBe('VALIDATION_FAILED');
    expect(await state(host)).toMatchObject({ phase: 'ROLE_REVEAL', stateVersion });
  });

  it('refuses to close a lobby', async () => {
    const [host] = await fullRoom('INFECTION', 2);
    const { stateVersion } = await state(host!);
    expect(errorCode((await closeRaw(host!, { stateVersion }).expect(409)).body)).toBe('PHASE_CONFLICT');
  });

  it('lets one of two closes with the same version through', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    const { stateVersion } = await state(host);
    const results = await Promise.all([closeRaw(host, { stateVersion }), closeRaw(host, { stateVersion })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await state(host)).toMatchObject({ phase: 'NIGHT_SUBMIT', stateVersion: stateVersion + 1 });
  });

  it('leaves the phase unchanged when the resolution fails', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    const before = await closeUntil(host, 'NIGHT_REACTION');
    failNight = true;
    const res = await closeRaw(host, { stateVersion: before.stateVersion }).expect(500);
    expect(errorCode(res.body)).toBe('INTERNAL');
    expect(await state(host)).toMatchObject({ phase: 'NIGHT_REACTION', stateVersion: before.stateVersion });
  });

  it('finishes the game when the night ends it, and skips the day (OD-68)', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    const reaction = await closeUntil(host, 'NIGHT_REACTION');
    night = { gameOver: true };
    const finished = await close(host);
    expect(finished).toMatchObject({ status: 'FINISHED', phase: 'FINISHED', roundNumber: 1, close: null, phaseEndsAt: null });
    expect(errorCode((await closeRaw(host, { stateVersion: finished.stateVersion }).expect(409)).body)).toBe('PHASE_CONFLICT');
    expect(finished.stateVersion).toBe(reaction.stateVersion + 1);
  });

  it('opens one revote on a tie, and returns to night on a second tie (OD-40)', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    await closeUntil(host, 'VOTING');
    day = { gameOver: false, tied: true };
    expect(await close(host)).toMatchObject({ phase: 'REVOTE', roundNumber: 1, close: { next: null, resolves: 'DAY' } });
    expect(await close(host)).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });
    expect(calls).toEqual(['night:1', 'day:1:FIRST', 'day:1:REVOTE']);
  });

  it('cannot close a cancelled game', async () => {
    const seats = await startedGame('INFECTION');
    const host = seats[0]!;
    await close(host);
    await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(host)).expect(200);
    const cancelled = await state(host);
    expect(cancelled).toMatchObject({ status: 'CANCELLED', phase: 'CANCELLED', close: null, phaseEndsAt: null });
    expect((await closeRaw(host, { stateVersion: cancelled.stateVersion }).expect(409)).status).toBe(409);
  });
});

describe('Classic, timed (WW-502, WW-503)', () => {
  it('skips host confirm and the reaction window, and resolves at the end of night submission', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    const nightPhase = await close(host);
    expect(nightPhase).toMatchObject({ phase: 'NIGHT_SUBMIT', pacing: 'TIMED', close: { next: null, resolves: 'NIGHT' } });
    expect((await close(host)).phase).toBe('DAY_ANNOUNCE');
    expect(calls).toEqual(['night:1']);
  });

  it('sets the configured deadline on each timed phase, and none on the others', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    expect((await state(host)).phaseEndsAt).toBeNull();

    const nightPhase = await close(host);
    expect(nightPhase).toMatchObject({ phase: 'NIGHT_SUBMIT', phaseStartedAt: T0.toISOString(), phaseEndsAt: later(90) });
    expect(scheduler.at(host.gameId)).toBe(later(90));

    const announce = await close(host);
    expect(announce).toMatchObject({ phase: 'DAY_ANNOUNCE', phaseEndsAt: null });
    expect(scheduler.at(host.gameId)).toBeNull();

    expect(await close(host)).toMatchObject({ phase: 'DAY_DISCUSSION', phaseEndsAt: later(180) });
    expect(await close(host)).toMatchObject({ phase: 'VOTING', phaseEndsAt: later(60) });
  });

  it('closes a phase by timer only once its deadline has passed', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    const nightPhase = await close(host);

    advance(89);
    await scheduler.fire(host.gameId);
    expect(await state(host)).toMatchObject({ phase: 'NIGHT_SUBMIT', stateVersion: nightPhase.stateVersion });
    expect(scheduler.at(host.gameId)).toBe(later(90));

    advance(1);
    await scheduler.fire(host.gameId);
    expect(await state(host)).toMatchObject({ phase: 'DAY_ANNOUNCE', stateVersion: nightPhase.stateVersion + 1, phaseEndsAt: null });
    expect(calls).toEqual(['night:1']);
  });

  it('runs a whole round on timers once the host opens the day', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    await close(host);
    advance(90);
    await scheduler.fire(host.gameId);
    await close(host); // The announcement waits for the host.
    advance(180);
    await scheduler.fire(host.gameId);
    expect(await state(host)).toMatchObject({ phase: 'VOTING', phaseEndsAt: new Date(now.getTime() + 60_000).toISOString() });
    advance(60);
    await scheduler.fire(host.gameId);
    const nextNight = await state(host);
    expect(nextNight).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2, phaseEndsAt: new Date(now.getTime() + 90_000).toISOString() });
    expect(calls).toEqual(['night:1', 'day:1:FIRST']);
  });

  it('lets the host close a timed phase early, and the old deadline does nothing', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    await close(host);
    const stale = scheduler.entries.get(host.gameId)!;
    await close(host);
    advance(90);
    await stale.task();
    expect((await state(host)).phase).toBe('DAY_ANNOUNCE');
    expect(calls).toEqual(['night:1']);
  });

  it('keeps the deadline through a host transfer', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    await close(host);
    await api().post(`/api/v1/games/${host.gameId}/host/transfer`).set(bearer(host)).send({ playerId: seats[1]!.playerId }).expect(200);
    advance(90);
    await scheduler.fire(host.gameId);
    expect((await state(seats[1]!)).phase).toBe('DAY_ANNOUNCE');
  });

  it('ignores the deadline of a cancelled game', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    await close(host);
    await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(host)).expect(200);
    advance(90);
    await scheduler.fire(host.gameId);
    expect(await state(host)).toMatchObject({ status: 'CANCELLED', phase: 'CANCELLED' });
    expect(calls).toEqual([]);
  });

  it('tries a failed timed close again', async () => {
    const seats = await startedGame('CLASSIC');
    const host = seats[0]!;
    await close(host);
    advance(90);
    failNight = true;
    await scheduler.fire(host.gameId);
    expect((await state(host)).phase).toBe('NIGHT_SUBMIT');
    expect(scheduler.at(host.gameId)).toBe(new Date(now.getTime() + 5_000).toISOString());

    failNight = false;
    advance(5);
    await scheduler.fire(host.gameId);
    expect((await state(host)).phase).toBe('DAY_ANNOUNCE');
  });
});

describe('restart (WW-502, OD-57)', () => {
  it('closes a timed phase whose deadline passed while the server was down, and leaves host-paced games waiting', async () => {
    const restartDb = await createTestDatabase();
    const config = loadConfig({ DATABASE_URL: restartDb.url });
    const before = await createApp(config, { logger: false, overrides: { clock, scheduler: new ManualScheduler(), resolvers } });
    await before.init();
    let after: INestApplication | undefined;
    try {
      const timed = (await startedGame('CLASSIC', before))[0]!;
      const paced = (await startedGame('INFECTION', before))[0]!;
      for (const host of [timed, paced]) {
        const { body } = await api(before).get(`/api/v1/games/${host.gameId}/state`).set(bearer(host)).expect(200);
        await api(before).post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: body.stateVersion }).expect(200);
      }
      await before.close();

      // The deadline passes while nothing is running.
      await restartDb.pool.query(`update games set phase_ends_at = now() - interval '1 minute' where id = $1`, [timed.gameId]);

      // The real clock and real timers, as in production.
      after = await createApp(config, { logger: false, overrides: { resolvers } });
      await after.init();

      const phaseOf = async (gameId: string) =>
        (await restartDb.pool.query<{ phase: string }>(`select phase from games where id = $1`, [gameId])).rows[0]!.phase;
      for (let i = 0; i < 50 && (await phaseOf(timed.gameId)) === 'NIGHT_SUBMIT'; i++) await new Promise((r) => setTimeout(r, 100));

      expect(await phaseOf(timed.gameId)).toBe('DAY_ANNOUNCE');
      expect(await phaseOf(paced.gameId)).toBe('NIGHT_SUBMIT');
    } finally {
      await after?.close();
      await restartDb.drop();
    }
  });
});

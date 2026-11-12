import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { configurationResponseSchema, errorBodySchema, gameEventsResponseSchema, gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1303: the audit of every host route, kept as a test so it cannot go
 * stale. Each route the server mounts is classified here; a new route that
 * nobody classified fails the inventory. Every host route refuses a missing
 * token (401), a token from another game (404), and a guest (403). No route
 * writes a role or a winner: only the start, the resolvers, and the victory
 * evaluator touch those tables, and every host body is strict.
 */

type Access = 'PUBLIC' | 'ENTRY' | 'MEMBER' | 'HOST';

/** Every mounted route. `ENTRY` creates or joins a seat, so it has no token yet. */
const INVENTORY: Readonly<Record<string, Access>> = {
  'get /api/v1/health': 'PUBLIC',
  'get /api/v1/health/ready': 'PUBLIC',
  'get /api/v1/version': 'PUBLIC',
  'get /api/v1/role-catalog': 'PUBLIC',
  'get /api/v1/role-catalog/:roleId': 'PUBLIC',
  'get /api/v1/role-packs': 'PUBLIC',
  'get /api/v1/role-packs/:packId': 'PUBLIC',
  'post /api/v1/games': 'ENTRY',
  'post /api/v1/games/join': 'ENTRY',
  'get /api/v1/games/:gameId': 'MEMBER',
  'post /api/v1/games/:gameId/leave': 'MEMBER',
  'put /api/v1/games/:gameId/me/avatar': 'MEMBER',
  'get /api/v1/games/:gameId/configuration': 'MEMBER',
  'get /api/v1/games/:gameId/me': 'MEMBER',
  'get /api/v1/games/:gameId/state': 'MEMBER',
  'post /api/v1/games/:gameId/actions': 'MEMBER',
  'get /api/v1/games/:gameId/me/actions': 'MEMBER',
  'post /api/v1/games/:gameId/votes': 'MEMBER',
  'get /api/v1/games/:gameId/events': 'MEMBER',
  'get /api/v1/games/:gameId/chat': 'MEMBER',
  'post /api/v1/games/:gameId/chat/messages': 'MEMBER',
  'get /api/v1/games/:gameId/results': 'MEMBER',
  'get /api/v1/games/:gameId/tallies': 'MEMBER',
  'post /api/v1/games/:gameId/players/:playerId/kick': 'HOST',
  'post /api/v1/games/:gameId/host/transfer': 'HOST',
  'post /api/v1/games/:gameId/host/cancel': 'HOST',
  'put /api/v1/games/:gameId/configuration': 'HOST',
  'post /api/v1/games/:gameId/configuration/validate': 'HOST',
  'post /api/v1/games/:gameId/start': 'HOST',
  'get /api/v1/games/:gameId/host/roster': 'HOST',
  'post /api/v1/games/:gameId/host/phase/close': 'HOST',
  'get /api/v1/games/:gameId/host/kill-target': 'HOST',
  'post /api/v1/games/:gameId/host/kill-target': 'HOST',
  'get /api/v1/games/:gameId/host/dashboard': 'HOST',
  'delete /api/v1/games/:gameId/chat/messages/:messageId': 'HOST',
  'put /api/v1/games/:gameId/chat/mutes/:playerId': 'HOST',
  'delete /api/v1/games/:gameId/chat/mutes/:playerId': 'HOST',
};

let db: TestDatabase;
let app: INestApplication;
let host: SeatCredentials;
let guest: SeatCredentials;
let other: SeatCredentials;
let draft: unknown;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const errorCode = (body: unknown) => errorBodySchema.parse(body).error.code;

async function room(mode: 'CLASSIC' | 'INFECTION', players: number): Promise<SeatCredentials[]> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode }).expect(201);
  const first = seatCredentialsSchema.parse(created.body);
  const seats = [first];
  for (let i = 2; i <= players; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: first.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  return seats;
}

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
  const seats = await room('CLASSIC', 10);
  host = seats[0]!;
  guest = seats[4]!;
  draft = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body).draft;
  await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
  other = (await room('CLASSIC', 2))[0]!;
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

function mounted(): string[] {
  const instance = app.getHttpAdapter().getInstance() as { router?: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } };
  return (instance.router?.stack ?? []).flatMap((layer) => (layer.route ? Object.keys(layer.route.methods).map((m) => `${m} ${layer.route!.path}`) : []));
}

/** A concrete request for a route key, with a body the host would send. */
function call(key: string, seat: SeatCredentials | null, gameId = host.gameId) {
  const [method, template] = key.split(' ') as [string, string];
  const path = template
    .replace(':gameId', gameId)
    .replace(':playerId', guest.playerId)
    .replace(':messageId', randomUUID())
    .replace(':roleId', 'seeker')
    .replace(':packId', 'classic-10');
  const bodies: Record<string, unknown> = {
    'post /api/v1/games/:gameId/host/transfer': { playerId: guest.playerId },
    'put /api/v1/games/:gameId/configuration': draft,
    'post /api/v1/games/:gameId/configuration/validate': draft,
    'post /api/v1/games/:gameId/start': { acknowledgeWarnings: true },
    'post /api/v1/games/:gameId/host/phase/close': { stateVersion: 1 },
    'post /api/v1/games/:gameId/host/kill-target': { noKill: true },
    'post /api/v1/games/:gameId/chat/messages': { body: 'hello' },
    'post /api/v1/games/:gameId/votes': { targetPlayerId: null },
    'post /api/v1/games/:gameId/actions': { abilityInstanceId: randomUUID(), targetPlayerIds: [] },
    'put /api/v1/games/:gameId/me/avatar': { avatarId: 30 },
    'post /api/v1/games/:gameId/leave': {},
  };
  let req = (api() as unknown as Record<string, (p: string) => request.Test>)[method]!(path);
  if (seat) req = req.set(bearer(seat));
  if (key === 'post /api/v1/games/:gameId/actions') req = req.set('Idempotency-Key', randomUUID());
  return key in bodies ? req.send(bodies[key] as object) : req;
}

const hostRoutes = Object.entries(INVENTORY).filter(([, access]) => access === 'HOST').map(([key]) => key);
const memberRoutes = Object.entries(INVENTORY).filter(([, access]) => access === 'MEMBER').map(([key]) => key);
const publicRoutes = Object.entries(INVENTORY).filter(([, access]) => access === 'PUBLIC').map(([key]) => key);

describe('route inventory', () => {
  it('classifies every mounted route, and every classified route is mounted', () => {
    const routes = mounted();
    expect(routes.length).toBeGreaterThan(30);
    expect(routes.filter((r) => !(r in INVENTORY))).toEqual([]);
    expect(Object.keys(INVENTORY).filter((r) => !routes.includes(r))).toEqual([]);
  });

  it('puts every /host/ path in the host class', () => {
    for (const key of Object.keys(INVENTORY).filter((k) => k.includes('/host/'))) expect(INVENTORY[key]).toBe('HOST');
  });
});

describe('host routes', () => {
  it.each(hostRoutes)('%s: 401 without a token', async (key) => {
    expect(errorCode((await call(key, null).expect(401)).body)).toBe('UNAUTHENTICATED');
  });

  it.each(hostRoutes)('%s: 404 for a token from another game', async (key) => {
    expect(errorCode((await call(key, other).expect(404)).body)).toBe('NOT_FOUND');
  });

  it.each(hostRoutes)('%s: 403 for a guest of this game', async (key) => {
    expect(errorCode((await call(key, guest).expect(403)).body)).toBe('NOT_HOST');
  });
});

describe('member routes', () => {
  it.each(memberRoutes)('%s: 401 without a token', async (key) => {
    expect(errorCode((await call(key, null).expect(401)).body)).toBe('UNAUTHENTICATED');
  });

  it.each(memberRoutes)('%s: 404 for a token from another game', async (key) => {
    expect(errorCode((await call(key, other).expect(404)).body)).toBe('NOT_FOUND');
  });
});

describe('public routes', () => {
  it.each(publicRoutes)('%s: answers without a token', async (key) => {
    await call(key, null).expect(200);
  });
});

describe('no route writes a role or a winner', () => {
  const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
    });
  const writers = (pattern: RegExp) =>
    files(srcDir)
      .filter((f) => pattern.test(readFileSync(f, 'utf8')))
      .map((f) => relative(srcDir, f))
      .sort();

  it('lets only the start, the resolvers, and the victory evaluator write assignments and victories', () => {
    // An insert or update of these tables, or the repository helper that updates an assignment.
    expect(writers(/\.(insert|update)\(roleAssignments\)|changeAssignment\(/)).toEqual(
      ['assignment/assignment.repository.ts', 'night/night-resolution.service.ts', 'victory/apply-victory.ts'].sort(),
    );
    expect(writers(/\.(insert|update)\(victoryRecords\)/)).toEqual(['victory/apply-victory.ts']);
    // A write sets the column to an object; the schema only declares it.
    expect(writers(/winnerSummary:\s*\{/)).toEqual(['victory/apply-victory.ts']);
  });

  it('keeps those tables out of every controller', () => {
    const controllers = files(srcDir).filter((f) => /@Controller\(/.test(readFileSync(f, 'utf8')));
    expect(controllers.length).toBeGreaterThan(10);
    for (const file of controllers) {
      const code = readFileSync(file, 'utf8');
      // A controller file may hold its own small service, but never one that writes roles or winners.
      expect(code, relative(srcDir, file)).not.toMatch(/\.(insert|update)\((roleAssignments|victoryRecords)\)|changeAssignment\(|winnerSummary:\s*\{/);
    }
  });

  it('refuses a smuggled role, assignment, or winner on every host write', async () => {
    const smuggle: [string, Record<string, unknown>][] = [
      ['post /api/v1/games/:gameId/host/phase/close', { stateVersion: 1, winner: 'VILLAGE' }],
      ['post /api/v1/games/:gameId/host/kill-target', { noKill: true, roleId: 'alpha_wolf' }],
      ['post /api/v1/games/:gameId/host/transfer', { playerId: guest.playerId, roleId: 'seeker' }],
      ['post /api/v1/games/:gameId/start', { acknowledgeWarnings: true, assignments: { [guest.playerId]: 'pack_wolf' } }],
      ['put /api/v1/games/:gameId/configuration', { ...(draft as object), assignments: { [guest.playerId]: 'pack_wolf' } }],
    ];
    for (const [key, body] of smuggle) {
      const [method, template] = key.split(' ') as [string, string];
      const res = await (api() as unknown as Record<string, (p: string) => request.Test>)[method]!(template.replace(':gameId', host.gameId)).set(bearer(host)).send(body);
      expect([key, res.status, errorCode(res.body)]).toEqual([key, 422, 'VALIDATION_FAILED']);
    }
  });

  it('refuses a setup change once roles are dealt', async () => {
    expect(errorCode((await call('put /api/v1/games/:gameId/configuration', host).expect(409)).body)).toBe('GAME_STARTED');
  });
});

describe('host-only facts stay off player routes', () => {
  it('gives a guest no host-audience event after a night', async () => {
    let current = gameStateSchema.parse((await api().get(`/api/v1/games/${host.gameId}/state`).set(bearer(host)).expect(200)).body) as GameState;
    for (let i = 0; current.phase !== 'DAY_ANNOUNCE' && i < 6; i++) {
      if (current.phase === 'NIGHT_HOST_CONFIRM') await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ noKill: true }).expect(200);
      current = gameStateSchema.parse((await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: current.stateVersion }).expect(200)).body);
    }
    expect(current.phase).toBe('DAY_ANNOUNCE');
    const hostEvents = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events?afterSeq=0`).set(bearer(host)).expect(200)).body).events;
    const guestEvents = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events?afterSeq=0`).set(bearer(guest)).expect(200)).body).events;
    expect(hostEvents.some((e) => e.audience === 'HOST')).toBe(true);
    expect(guestEvents.filter((e) => e.audience === 'HOST')).toEqual([]);
  });
});

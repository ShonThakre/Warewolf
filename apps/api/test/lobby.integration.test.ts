import type { INestApplication } from '@nestjs/common';
import {
  configurationResponseSchema,
  errorBodySchema,
  leaveGameResponseSchema,
  lobbyProjectionSchema,
  rolePackListSchema,
  seatCredentialsSchema,
  type SeatCredentials,
} from '@warewolf/contracts';
import { getPack } from '@warewolf/domain';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

let db: TestDatabase;
let app: INestApplication;
const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });

async function create(displayName = 'Asha', mode = 'CLASSIC'): Promise<SeatCredentials> {
  const res = await api().post('/api/v1/games').send({ displayName, mode }).expect(201);
  return seatCredentialsSchema.parse(res.body);
}

async function join(roomCode: string, displayName: string, avatarId?: number): Promise<SeatCredentials> {
  const res = await api().post('/api/v1/games/join').send({ roomCode, displayName, avatarId }).expect(201);
  return seatCredentialsSchema.parse(res.body);
}

async function lobby(seat: SeatCredentials) {
  const res = await api().get(`/api/v1/games/${seat.gameId}`).set(bearer(seat)).expect(200);
  return lobbyProjectionSchema.parse(res.body);
}

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

describe('create and join', () => {
  it('creates a room with the host in seat 1 and the mode default pack', async () => {
    const host = await create('Asha', 'CLASSIC');
    expect(host.isHost).toBe(true);
    expect(host.roomCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(host.token).toMatch(/^ww_/);

    const view = await lobby(host);
    expect(view).toMatchObject({
      status: 'LOBBY',
      phase: 'LOBBY',
      mode: 'CLASSIC',
      rolePackId: 'classic-10',
      playerCount: 10,
      hostPlayerId: host.playerId,
      you: { playerId: host.playerId, isHost: true },
      players: [{ playerId: host.playerId, displayName: 'Asha', seatNumber: 1, avatarId: 1, isHost: true }],
      start: { ready: false, blockers: ['SEATS_OPEN'] },
    });
  });

  it('defaults to Infection Edition at 20 players (WW-703, C-01, C-02)', async () => {
    const res = await api().post('/api/v1/games').send({ displayName: 'Default' }).expect(201);
    expect(await lobby(seatCredentialsSchema.parse(res.body))).toMatchObject({ mode: 'INFECTION', rolePackId: 'infection-core', playerCount: 20 });
  });

  it('lets two clients join the same room and see each other', async () => {
    const host = await create();
    const rafi = await join(host.roomCode.toLowerCase(), '  Rafi ');
    expect(rafi).toMatchObject({ gameId: host.gameId, isHost: false });

    const fromHost = await lobby(host);
    const fromRafi = await lobby(rafi);
    expect(fromHost.players.map((p) => [p.displayName, p.seatNumber])).toEqual([
      ['Asha', 1],
      ['Rafi', 2],
    ]);
    expect(fromRafi.players).toEqual(fromHost.players);
    expect(fromRafi.you).toEqual({ playerId: rafi.playerId, isHost: false });
    expect(fromHost.stateVersion).toBe(1);
  });

  it('rejects a taken name, ignoring case', async () => {
    const host = await create('Asha');
    const res = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'ASHA' }).expect(409);
    expect(errorCode(res.body)).toBe('DISPLAY_NAME_TAKEN');
  });

  it('rejects an unknown room code with 404', async () => {
    const res = await api().post('/api/v1/games/join').send({ roomCode: 'ZZZZZZ', displayName: 'Lost' }).expect(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
  });

  it('rejects an invalid name with 422 and field issues', async () => {
    const res = await api().post('/api/v1/games').send({ displayName: 'A' }).expect(422);
    const body = errorBodySchema.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.issues?.[0]?.path).toBe('displayName');
  });

  it('closes join when every seat is taken', async () => {
    const host = await create('Host', 'CLASSIC');
    for (let i = 2; i <= 10; i++) await join(host.roomCode, `Player ${i}`);
    const res = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Eleventh' }).expect(409);
    expect(errorCode(res.body)).toBe('ROOM_FULL');
    expect((await lobby(host)).start).toEqual({ ready: true, blockers: [], requiresWarningAcknowledgement: true });
  });

  it('closes join after start', async () => {
    const host = await create();
    await db.pool.query(`update games set status = 'ACTIVE', phase = 'ROLE_REVEAL', round_number = 1 where id = $1`, [host.gameId]);
    const res = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Late' }).expect(409);
    expect(errorCode(res.body)).toBe('GAME_STARTED');
  });

  it('serializes concurrent joins so seats and capacity stay consistent', async () => {
    const host = await create('Host', 'CLASSIC');
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Racer ${i}` }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(9);
    expect(results.filter((r) => r.status === 409).map((r) => errorCode(r.body))).toEqual(Array(3).fill('ROOM_FULL'));
    const seats = (await lobby(host)).players.map((p) => p.seatNumber);
    expect(seats).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('seat tokens', () => {
  it('requires a token', async () => {
    const host = await create();
    expect(errorCode((await api().get(`/api/v1/games/${host.gameId}`).expect(401)).body)).toBe('UNAUTHENTICATED');
    await api().get(`/api/v1/games/${host.gameId}`).set({ Authorization: 'Bearer ww_nonsense' }).expect(401);
  });

  it('returns 404 for a token from another game', async () => {
    const a = await create('Alpha');
    const b = await create('Bravo');
    const res = await api().get(`/api/v1/games/${b.gameId}`).set(bearer(a)).expect(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
    await api().get('/api/v1/games/not-a-uuid').set(bearer(a)).expect(404);
  });

  it('never returns tokens or token hashes in the lobby', async () => {
    const host = await create();
    const guest = await join(host.roomCode, 'Guest');
    const { rows } = await db.pool.query<{ token_hash: string }>(`select token_hash from game_players where game_id = $1`, [host.gameId]);
    const body = JSON.stringify((await api().get(`/api/v1/games/${host.gameId}`).set(bearer(guest))).body);
    for (const secret of [host.token, guest.token, ...rows.map((r) => r.token_hash)]) expect(body).not.toContain(secret);
  });

  it('stores only a hash of each token', async () => {
    const host = await create();
    const { rows } = await db.pool.query<{ token_hash: string }>(`select token_hash from game_players where id = $1`, [host.playerId]);
    expect(rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.token_hash).not.toContain(host.token);
  });
});

describe('leave, kick, transfer, cancel', () => {
  it('a guest leaving frees the seat for the next joiner', async () => {
    const host = await create();
    const a = await join(host.roomCode, 'Aya');
    await join(host.roomCode, 'Ben');
    const res = await api().post(`/api/v1/games/${host.gameId}/leave`).set(bearer(a)).send({}).expect(200);
    expect(leaveGameResponseSchema.parse(res.body)).toEqual({ gameCancelled: false });
    await api().get(`/api/v1/games/${host.gameId}`).set(bearer(a)).expect(401);
    const c = await join(host.roomCode, 'Cy');
    expect((await lobby(c)).players.map((p) => [p.displayName, p.seatNumber])).toEqual([
      ['Asha', 1],
      ['Cy', 2],
      ['Ben', 3],
    ]);
  });

  it('the host leaving cancels the room and frees the code', async () => {
    const host = await create();
    const guest = await join(host.roomCode, 'Guest');
    const res = await api().post(`/api/v1/games/${host.gameId}/leave`).set(bearer(host)).send({}).expect(200);
    expect(res.body).toEqual({ gameCancelled: true });
    expect(await lobby(guest)).toMatchObject({ status: 'CANCELLED', phase: 'CANCELLED', start: { ready: false } });
    await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Late' }).expect(404);
  });

  it('the host can leave and hand the room to another seat', async () => {
    const host = await create();
    const guest = await join(host.roomCode, 'Guest');
    await api().post(`/api/v1/games/${host.gameId}/leave`).set(bearer(host)).send({ hostPlayerId: guest.playerId }).expect(200);
    const view = await lobby(guest);
    expect(view).toMatchObject({ status: 'LOBBY', hostPlayerId: guest.playerId, you: { isHost: true } });
    expect(view.players).toHaveLength(1);
  });

  it('only the host can kick, only in the lobby, and the kicked player can rejoin', async () => {
    const host = await create();
    const a = await join(host.roomCode, 'Aya');
    const b = await join(host.roomCode, 'Ben');
    const denied = await api().post(`/api/v1/games/${host.gameId}/players/${b.playerId}/kick`).set(bearer(a)).expect(403);
    expect(errorCode(denied.body)).toBe('NOT_HOST');

    const kicked = await api().post(`/api/v1/games/${host.gameId}/players/${b.playerId}/kick`).set(bearer(host)).expect(200);
    expect(lobbyProjectionSchema.parse(kicked.body).players.map((p) => p.displayName)).toEqual(['Asha', 'Aya']);
    await api().get(`/api/v1/games/${host.gameId}`).set(bearer(b)).expect(401);
    await join(host.roomCode, 'Ben');

    await api().post(`/api/v1/games/${host.gameId}/players/${host.playerId}/kick`).set(bearer(host)).expect(422);
    await api().post(`/api/v1/games/${host.gameId}/players/not-a-uuid/kick`).set(bearer(host)).expect(404);
    const other = await create('Other');
    await api().post(`/api/v1/games/${host.gameId}/players/${other.playerId}/kick`).set(bearer(host)).expect(404);
  });

  it('transfers host to another seat', async () => {
    const host = await create();
    const guest = await join(host.roomCode, 'Guest');
    const res = await api().post(`/api/v1/games/${host.gameId}/host/transfer`).set(bearer(host)).send({ playerId: guest.playerId }).expect(200);
    expect(lobbyProjectionSchema.parse(res.body)).toMatchObject({ hostPlayerId: guest.playerId, you: { isHost: false } });
    await api().post(`/api/v1/games/${host.gameId}/host/transfer`).set(bearer(host)).send({ playerId: host.playerId }).expect(403);
    await api().post(`/api/v1/games/${host.gameId}/host/transfer`).set(bearer(guest)).send({ playerId: 'nope' }).expect(422);
  });

  it('cancels the game, after which lobby changes conflict', async () => {
    const host = await create();
    const guest = await join(host.roomCode, 'Guest');
    await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(guest)).expect(403);
    const res = await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(host)).expect(200);
    expect(lobbyProjectionSchema.parse(res.body).status).toBe('CANCELLED');
    expect(errorCode((await api().post(`/api/v1/games/${host.gameId}/host/cancel`).set(bearer(host)).expect(409)).body)).toBe('PHASE_CONFLICT');
    expect(errorCode((await api().post(`/api/v1/games/${host.gameId}/leave`).set(bearer(guest)).send({}).expect(409)).body)).toBe('GAME_STARTED');
    const { rows } = await db.pool.query(`select cancel_reason from games where id = $1`, [host.gameId]);
    expect(rows[0]).toEqual({ cancel_reason: 'HOST' });
  });
});

describe('configuration drafts', () => {
  const classic = getPack('classic-10')!.config;

  it('shows every member the draft and its validation, editable only for the host', async () => {
    const host = await create('Asha', 'CLASSIC');
    const guest = await join(host.roomCode, 'Guest');
    const asHost = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body);
    const asGuest = configurationResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(guest)).expect(200)).body);
    expect(asHost.draft).toEqual(classic);
    expect(asHost.editable).toBe(true);
    expect(asGuest.editable).toBe(false);
    expect(asHost.validation.warnings.map((w) => w.code)).toEqual(['UNCONFIRMED_PRESET']);
  });

  it('saves an invalid draft and keeps start closed', async () => {
    const host = await create('Asha', 'CLASSIC');
    const draft = { ...classic, roles: [...classic.roles, { roleId: 'priest', count: 1 }] };
    const res = await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send(draft).expect(200);
    const body = configurationResponseSchema.parse(res.body);
    expect(body.validation.valid).toBe(false);
    expect(body.validation.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['ROLE_UNRESOLVED', 'ROLE_COUNT_MISMATCH']));
    const view = await lobby(host);
    expect(view.start.blockers).toContain('CONFIG_INVALID');
    expect(view.configuration.valid).toBe(false);
    expect(view.stateVersion).toBe(1);
  });

  it('switching packs changes the mode and the room size', async () => {
    const host = await create('Asha', 'CLASSIC');
    const infection = getPack('infection-core')!.config;
    await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send(infection).expect(200);
    expect(await lobby(host)).toMatchObject({ mode: 'INFECTION', rolePackId: 'infection-core', playerCount: 20 });
  });

  it('rejects a malformed draft with 422', async () => {
    const host = await create();
    const res = await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send({ ...classic, surprise: 1 }).expect(422);
    expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
  });

  it('only the host may save or validate, and only in the lobby', async () => {
    const host = await create('Asha', 'CLASSIC');
    const guest = await join(host.roomCode, 'Guest');
    await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(guest)).send(classic).expect(403);
    await api().post(`/api/v1/games/${host.gameId}/configuration/validate`).set(bearer(guest)).send(classic).expect(403);

    const checked = await api().post(`/api/v1/games/${host.gameId}/configuration/validate`).set(bearer(host)).send({ ...classic, playerCount: 11 }).expect(200);
    expect(configurationResponseSchema.parse(checked.body).validation.errors.map((e) => e.code)).toContain('ROLE_COUNT_MISMATCH');
    expect((await lobby(host)).playerCount).toBe(10);

    await db.pool.query(`update games set status = 'ACTIVE', phase = 'ROLE_REVEAL', round_number = 1 where id = $1`, [host.gameId]);
    expect(errorCode((await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send(classic).expect(409)).body)).toBe('GAME_STARTED');
    await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(409);
  });
});

describe('avatars', () => {
  const avatars = async (seat: SeatCredentials) => Object.fromEntries((await lobby(seat)).players.map((p) => [p.displayName, p.avatarId]));

  it('assigns the lowest free avatar, or the one asked for', async () => {
    const res = await api().post('/api/v1/games').send({ displayName: 'Asha', mode: 'CLASSIC', avatarId: 7 }).expect(201);
    const host = seatCredentialsSchema.parse(res.body);
    await join(host.roomCode, 'Ben');
    await join(host.roomCode, 'Cy', 2);
    await join(host.roomCode, 'Dee');
    expect(await avatars(host)).toEqual({ Asha: 7, Ben: 1, Cy: 2, Dee: 3 });
  });

  it('rejects an avatar someone in the room already has', async () => {
    const host = await create('Asha');
    const res = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Ben', avatarId: 1 }).expect(409);
    expect(errorCode(res.body)).toBe('AVATAR_TAKEN');
    await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: 'Ben', avatarId: 37 }).expect(422);
  });

  it('gives concurrent joiners different avatars', async () => {
    const host = await create('Host', 'CLASSIC');
    await Promise.all(Array.from({ length: 9 }, (_, i) => join(host.roomCode, `Racer ${i}`)));
    const ids = (await lobby(host)).players.map((p) => p.avatarId).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('lets a player change avatar in the lobby', async () => {
    const host = await create('Asha');
    const ben = await join(host.roomCode, 'Ben');
    const res = await api().put(`/api/v1/games/${host.gameId}/me/avatar`).set(bearer(ben)).send({ avatarId: 20 }).expect(200);
    const view = lobbyProjectionSchema.parse(res.body);
    expect(view.players.find((p) => p.playerId === ben.playerId)?.avatarId).toBe(20);
    expect(view.stateVersion).toBe(2);

    const same = await api().put(`/api/v1/games/${host.gameId}/me/avatar`).set(bearer(ben)).send({ avatarId: 20 }).expect(200);
    expect(lobbyProjectionSchema.parse(same.body).stateVersion).toBe(2);

    const taken = await api().put(`/api/v1/games/${host.gameId}/me/avatar`).set(bearer(ben)).send({ avatarId: 1 }).expect(409);
    expect(errorCode(taken.body)).toBe('AVATAR_TAKEN');
    await api().put(`/api/v1/games/${host.gameId}/me/avatar`).send({ avatarId: 3 }).expect(401);
  });

  it('frees a kicked player\'s avatar', async () => {
    const host = await create('Asha');
    const ben = await join(host.roomCode, 'Ben', 12);
    await api().post(`/api/v1/games/${host.gameId}/players/${ben.playerId}/kick`).set(bearer(host)).expect(200);
    await join(host.roomCode, 'Cy', 12);
  });

  it('cannot change avatar after start', async () => {
    const host = await create();
    await db.pool.query(`update games set status = 'ACTIVE', phase = 'ROLE_REVEAL', round_number = 1 where id = $1`, [host.gameId]);
    const res = await api().put(`/api/v1/games/${host.gameId}/me/avatar`).set(bearer(host)).send({ avatarId: 5 }).expect(409);
    expect(errorCode(res.body)).toBe('GAME_STARTED');
  });
});

describe('role catalog and packs', () => {
  it('lists the 51 roles with the catalog hash', async () => {
    const res = await api().get('/api/v1/role-catalog').expect(200);
    expect(res.body.roles).toHaveLength(51);
    expect(res.body.hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await api().get('/api/v1/role-catalog/seeker').expect(200)).body.displayName).toBe('Seeker');
    expect((await api().get('/api/v1/role-catalog/vampire').expect(200)).body.displayName).toBe('Vampire');
    await api().get('/api/v1/role-catalog/not_a_role').expect(404);
  });

  it('lists the packs with their validation codes', async () => {
    const packs = rolePackListSchema.parse((await api().get('/api/v1/role-packs').expect(200)).body);
    expect(packs).toHaveLength(10);
    expect(packs.find((p) => p.id === 'infection-core')).toMatchObject({ status: 'CONFIRMED', errorCodes: [], warningCodes: [] });
    expect(packs.find((p) => p.id === 'chaos-15')).toMatchObject({ status: 'RECOMMENDED', blockedBy: [], errorCodes: [] });
    expect((await api().get('/api/v1/role-packs/classic-10').expect(200)).body.config.playerCount).toBe(10);
    await api().get('/api/v1/role-packs/nope').expect(404);
  });
});

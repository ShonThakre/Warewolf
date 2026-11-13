import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { errorBodySchema, gameEventsResponseSchema, gameStateSchema, myRoleSchema, seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

let db: TestDatabase;
let app: INestApplication;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });
const errorOf = (body: unknown) => errorBodySchema.parse(body).error;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

async function state(seat: SeatCredentials) {
  return gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat)).expect(200)).body);
}

async function close(host: SeatCredentials) {
  const current = await state(host);
  const res = await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: current.stateVersion }).expect(200);
  return gameStateSchema.parse(res.body);
}

async function closeUntil(host: SeatCredentials, phase: string) {
  for (let i = 0; i < 8; i++) {
    const current = await state(host);
    if (current.phase === phase) return current;
    await close(host);
  }
  throw new Error(`never reached ${phase}`);
}

function submit(seat: SeatCredentials, body: object) {
  return api().post(`/api/v1/games/${seat.gameId}/actions`).set(bearer(seat)).set('Idempotency-Key', randomUUID()).send(body);
}

describe('Ultimate 20', () => {
  it('deals the locked roster, skips both night windows, and accepts the new submissions', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'ULTIMATE_20' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const seats = [host];
    for (let i = 2; i <= 20; i++) {
      const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
      seats.push(seatCredentialsSchema.parse(joined.body));
    }

    const draft = (await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body.draft;
    const locked = await api()
      .put(`/api/v1/games/${host.gameId}/configuration`)
      .set(bearer(host))
      .send({ ...draft, wolves: { ...draft.wolves, friendlyFire: true } })
      .expect(200);
    expect(locked.body.validation.errors.map((issue: { code: string }) => issue.code)).toContain('MODE_RULE_LOCKED');
    await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send(draft).expect(200);

    await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);

    const { rows } = await db.pool.query<{ original_role_id: string; current_profile_id: string; count: string }>(
      `select original_role_id, current_profile_id, count(*)::text as count from role_assignments where game_id = $1 group by 1, 2`,
      [host.gameId],
    );
    expect(rows).toHaveLength(16);
    expect(rows.find((row) => row.original_role_id === 'normal_villager')?.count).toBe('5');
    expect(rows.find((row) => row.original_role_id === 'alpha_wolf')?.current_profile_id).toBe('alpha_ultimate');
    expect(rows.find((row) => row.original_role_id === 'oracle')?.current_profile_id).toBe('oracle_alignment');
    expect(rows.find((row) => row.original_role_id === 'vampire_servant')).toBeUndefined();

    const seatOf = async (roleId: string) => {
      const found = await db.pool.query<{ player_id: string }>(
        `select player_id from role_assignments where game_id = $1 and original_role_id = $2`,
        [host.gameId, roleId],
      );
      return seats.find((seat) => seat.playerId === found.rows[0]!.player_id)!;
    };
    const abilityOf = async (seat: SeatCredentials, abilityId: string) => {
      const found = await db.pool.query<{ id: string }>(`select id from ability_instances where player_id = $1 and ability_id = $2`, [seat.playerId, abilityId]);
      return found.rows[0]!.id;
    };

    await closeUntil(host, 'NIGHT_SUBMIT');
    const alpha = await seatOf('alpha_wolf');
    const kill = await abilityOf(alpha, 'alpha_u20_kill');
    const infect = await abilityOf(alpha, 'alpha_u20_infect');
    const target = seats.find((seat) => seat.playerId !== alpha.playerId)!;
    await submit(alpha, { abilityInstanceId: kill, targetPlayerIds: [target.playerId] }).expect(200);
    await submit(alpha, { abilityInstanceId: infect, targetPlayerIds: [target.playerId] }).expect(200);
    const killRows = await db.pool.query<{ status: string }>(`select status from night_actions where ability_instance_id = $1`, [kill]);
    expect(killRows.rows.map((row) => row.status)).toEqual(['CANCELLED']);

    const ghost = await seatOf('ghost');
    const hint = await abilityOf(ghost, 'ghost_hint');
    const early = await submit(ghost, { abilityInstanceId: hint, targetPlayerIds: [], payload: { hint: 'a quiet night' } }).expect(409);
    expect(errorOf(early.body).code).toBe('ACTION_WRONG_PHASE');

    const afterNight = await close(host);
    expect(afterNight.phase).toBe('DAY_ANNOUNCE');

    await closeUntil(host, 'DAY_DISCUSSION');
    const mind = await seatOf('mind_controller');
    const control = await abilityOf(mind, 'mind_control');
    const voter = seats.find((seat) => seat.playerId !== mind.playerId)!;
    const ballot = seats.find((seat) => seat.playerId !== mind.playerId && seat.playerId !== voter.playerId)!;
    await submit(mind, { abilityInstanceId: control, targetPlayerIds: [voter.playerId, ballot.playerId] }).expect(200);

    await db.pool.query(`update game_players set life_status = 'DEAD', died_round = 1 where id = $1`, [ghost.playerId]);
    await db.pool.query(`update games set phase = 'NIGHT_SUBMIT', round_number = 2, state_version = state_version + 1 where id = $1`, [host.gameId]);
    const namedPlayer = await db.pool.query<{ display_name: string }>(`select display_name from game_players where id = $1`, [target.playerId]);
    const named = await submit(ghost, { abilityInstanceId: hint, targetPlayerIds: [], payload: { hint: `ask ${namedPlayer.rows[0]!.display_name}` } }).expect(422);
    expect(errorOf(named.body).code).toBe('ACTION_TARGET_ILLEGAL');
    await submit(ghost, { abilityInstanceId: hint, targetPlayerIds: [], payload: { hint: 'listen for the quiet one' } }).expect(200);
  });

  it('promotes a Vampire mark at dawn of the same night and keeps it private', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'ULTIMATE_20' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const seats = [host];
    for (let i = 2; i <= 20; i++) {
      const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
      seats.push(seatCredentialsSchema.parse(joined.body));
    }
    const draft = (await api().get(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).expect(200)).body.draft;
    await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send(draft).expect(200);
    await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);

    const seatOf = async (roleId: string) => {
      const found = await db.pool.query<{ player_id: string }>(
        `select player_id from role_assignments where game_id = $1 and original_role_id = $2`,
        [host.gameId, roleId],
      );
      return seats.find((seat) => seat.playerId === found.rows[0]!.player_id)!;
    };
    const villagers = await db.pool.query<{ player_id: string }>(
      `select player_id from role_assignments where game_id = $1 and original_role_id = 'normal_villager' order by player_id`,
      [host.gameId],
    );
    const villagerId = villagers.rows.find((row) => row.player_id !== host.playerId)?.player_id ?? villagers.rows[0]!.player_id;
    const villager = seats.find((seat) => seat.playerId === villagerId)!;
    const vampire = await seatOf('vampire');
    const outsider = (await Promise.all(['fox', 'oracle', 'joker', 'guardian'].map((roleId) => seatOf(roleId)))).find((seat) => seat.playerId !== host.playerId && seat.playerId !== villager.playerId && seat.playerId !== vampire.playerId)!;

    await closeUntil(host, 'NIGHT_SUBMIT');
    const mark = await db.pool.query<{ id: string }>(`select id from ability_instances where player_id = $1 and ability_id = 'vampire_mark'`, [vampire.playerId]);
    await submit(vampire, { abilityInstanceId: mark.rows[0]!.id, targetPlayerIds: [villager.playerId] }).expect(200);
    await close(host);

    const scheduled = await db.pool.query(`select id from scheduled_effects where target_player_id = $1 and kind = 'VAMPIRE_MARK'`, [villager.playerId]);
    expect(scheduled.rows).toEqual([]);

    const promoted = myRoleSchema.parse((await api().get(`/api/v1/games/${host.gameId}/me`).set(bearer(villager)).expect(200)).body);
    expect(promoted.originalRole.id).toBe('normal_villager');
    expect(promoted.currentRole.id).toBe('vampire_servant');
    expect(promoted.currentRole.faction).toBe('NEUTRAL');
    expect(promoted.teammatesVisible).toBe(true);
    expect(promoted.teammates.map((mate) => mate.playerId)).toEqual([vampire.playerId]);
    expect(promoted.abilities.map((ability) => ability.abilityId).sort()).toEqual(['servant_kill', 'servant_mark']);

    const vampireView = myRoleSchema.parse((await api().get(`/api/v1/games/${host.gameId}/me`).set(bearer(vampire)).expect(200)).body);
    expect(vampireView.teammates.map((mate) => mate.playerId)).toEqual([villager.playerId]);

    const outsiderView = myRoleSchema.parse((await api().get(`/api/v1/games/${host.gameId}/me`).set(bearer(outsider)).expect(200)).body);
    expect(outsiderView.teammatesVisible).toBe(false);
    expect(outsiderView.teammates).toEqual([]);

    const roster = (await api().get(`/api/v1/games/${host.gameId}/host/roster`).set(bearer(host)).expect(200)).body;
    const entry = roster.players.find((player: { playerId: string }) => player.playerId === villager.playerId);
    expect(entry).toMatchObject({ originalRoleId: 'normal_villager', currentRoleId: 'vampire_servant', currentFaction: 'NEUTRAL' });

    const seen = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(outsider)).expect(200)).body);
    expect(seen.events.some((event) => event.type === 'ROLE_CONVERTED' || event.type === 'VAMPIRE_TEAM_JOIN')).toBe(false);
    const told = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(villager)).expect(200)).body);
    expect(told.events.find((event) => event.type === 'ROLE_CONVERTED')?.payload).toMatchObject({
      roleId: 'vampire_servant',
      vampirePlayerId: vampire.playerId,
    });
    const ally = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(vampire)).expect(200)).body);
    expect(ally.events.some((event) => event.type === 'VAMPIRE_TEAM_JOIN' && event.payload.servantPlayerId === villager.playerId)).toBe(true);
  });
});

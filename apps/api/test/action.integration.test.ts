import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  errorBodySchema,
  gameStateSchema,
  myActionsSchema,
  seatCredentialsSchema,
  submitActionResponseSchema,
  type MyActions,
  type SeatCredentials,
} from '@warewolf/contracts';
import { DEFAULT_CATALOG } from '@warewolf/domain';
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

interface Game {
  readonly seats: SeatCredentials[];
  readonly host: SeatCredentials;
  /** The first seat dealt this role. */
  seat(roleId: string): Promise<SeatCredentials>;
  /** That seat's ability instance id. */
  ability(seat: SeatCredentials, abilityId: string): Promise<string>;
}

/** A started 20-seat Infection Edition game, host-paced. */
async function infectionGame(): Promise<Game> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'INFECTION' }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  const seats = [host];
  for (let i = 2; i <= 20; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({}).expect(200);

  return {
    seats,
    host,
    async seat(roleId) {
      const { rows } = await db.pool.query<{ player_id: string }>(
        `select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id limit 1`,
        [host.gameId, roleId],
      );
      return seats.find((s) => s.playerId === rows[0]!.player_id)!;
    },
    async ability(seat, abilityId) {
      const { rows } = await db.pool.query<{ id: string }>(`select id from ability_instances where player_id = $1 and ability_id = $2`, [seat.playerId, abilityId]);
      return rows[0]!.id;
    },
  };
}

/** Someone other than these seats, alive. */
const other = (game: Game, ...not: SeatCredentials[]) => game.seats.find((s) => !not.some((n) => n.playerId === s.playerId))!;

/** Host confirm needs a choice before it closes (WW-803). Chooses no kill unless the test already chose. */
async function ensureKillDecision(host: SeatCredentials): Promise<void> {
  const view = await api().get(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).expect(200);
  if ((view.body as { decision: unknown }).decision === null) {
    await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ noKill: true }).expect(200);
  }
}

async function closePhase(host: SeatCredentials): Promise<string> {
  const state = gameStateSchema.parse((await api().get(`/api/v1/games/${host.gameId}/state`).set(bearer(host)).expect(200)).body);
  if (state.phase === 'NIGHT_HOST_CONFIRM') await ensureKillDecision(host);
  const closed = await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: state.stateVersion }).expect(200);
  return gameStateSchema.parse(closed.body).phase;
}

async function closeUntil(host: SeatCredentials, phase: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const state = gameStateSchema.parse((await api().get(`/api/v1/games/${host.gameId}/state`).set(bearer(host)).expect(200)).body);
    if (state.phase === phase) return;
    await closePhase(host);
  }
  throw new Error(`never reached ${phase}`);
}

function submit(seat: SeatCredentials, body: object, key: string | null = randomUUID()) {
  const req = api().post(`/api/v1/games/${seat.gameId}/actions`).set(bearer(seat));
  return (key === null ? req : req.set('Idempotency-Key', key)).send(body);
}

async function mine(seat: SeatCredentials): Promise<MyActions> {
  return myActionsSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/me/actions`).set(bearer(seat)).expect(200)).body);
}

async function actionRows(abilityInstanceId: string) {
  const { rows } = await db.pool.query<{ id: string; status: string; target_player_ids: string[]; round_number: number }>(
    `select id, status, target_player_ids, round_number from night_actions where ability_instance_id = $1 order by created_at`,
    [abilityInstanceId],
  );
  return rows;
}

describe('POST /games/:gameId/actions (WW-601)', () => {
  it('accepts a Seeker investigation during night submission, and only then', async () => {
    const game = await infectionGame();
    const seeker = await game.seat('seeker');
    const ability = await game.ability(seeker, 'seeker_investigate');
    const target = other(game, seeker);

    const early = await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [target.playerId] }).expect(409);
    expect(errorOf(early.body).code).toBe('ACTION_WRONG_PHASE');

    await closePhase(game.host);
    const res = await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [target.playerId] }).expect(200);
    const action = submitActionResponseSchema.parse(res.body);
    expect(action).toMatchObject({ status: 'PENDING', abilityInstanceId: ability, roundNumber: 1, phase: 'NIGHT_SUBMIT', targetPlayerIds: [target.playerId], payload: {} });

    const view = await mine(seeker);
    expect(view).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 1 });
    expect(view.abilities.find((a) => a.abilityInstanceId === ability)).toMatchObject({ availability: 'OPEN', action });
    expect(view.abilities.find((a) => a.abilityId === 'seeker_public_reveal')).toMatchObject({ availability: 'NOT_THIS_PHASE', action: null });
  });

  it('returns no outcome and no role, only the caller\'s own choice', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const alpha = await game.seat('alpha_wolf');
    const res = await submit(seeker, { abilityInstanceId: await game.ability(seeker, 'seeker_investigate'), targetPlayerIds: [alpha.playerId] }).expect(200);
    const raw = JSON.stringify(res.body);
    for (const role of DEFAULT_CATALOG.roles) expect(raw).not.toContain(`"${role.id}"`);
    expect(raw).not.toMatch(/WOLF|ALIGN|result/i);
  });

  it('replays the same key and body, and refuses the same key with another body', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const ability = await game.ability(seeker, 'seeker_investigate');
    const [a, b] = [other(game, seeker), other(game, seeker, other(game, seeker))];
    const key = randomUUID();

    const first = submitActionResponseSchema.parse((await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [a.playerId] }, key).expect(200)).body);
    const again = submitActionResponseSchema.parse((await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [a.playerId], payload: {} }, key).expect(200)).body);
    expect(again).toEqual(first);
    expect(await actionRows(ability)).toHaveLength(1);

    const conflict = await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [b.playerId] }, key).expect(409);
    expect(errorOf(conflict.body).code).toBe('IDEMPOTENCY_CONFLICT');

    // A replay still answers after the window has closed.
    await closePhase(game.host);
    const late = submitActionResponseSchema.parse((await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [a.playerId] }, key).expect(200)).body);
    expect(late).toEqual(first);
  });

  it('scopes keys to the seat, so another player reusing a key gets their own result', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const guard = await game.seat('guard');
    const key = randomUUID();
    const target = other(game, seeker, guard);
    const mineRes = submitActionResponseSchema.parse((await submit(seeker, { abilityInstanceId: await game.ability(seeker, 'seeker_investigate'), targetPlayerIds: [target.playerId] }, key).expect(200)).body);
    const theirs = submitActionResponseSchema.parse((await submit(guard, { abilityInstanceId: await game.ability(guard, 'guard_protect'), targetPlayerIds: [target.playerId] }, key).expect(200)).body);
    expect(theirs.actionId).not.toBe(mineRes.actionId);
  });

  it('needs a well-formed Idempotency-Key and a strict body', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const body = { abilityInstanceId: await game.ability(seeker, 'seeker_investigate'), targetPlayerIds: [other(game, seeker).playerId] };
    expect(errorOf((await submit(seeker, body, null).expect(422)).body)).toMatchObject({ code: 'VALIDATION_FAILED', issues: [{ path: 'Idempotency-Key' }] });
    expect(errorOf((await submit(seeker, body, 'short').expect(422)).body).code).toBe('VALIDATION_FAILED');
    expect(errorOf((await submit(seeker, { ...body, roundNumber: 2 }).expect(422)).body).code).toBe('VALIDATION_FAILED');
  });

  it('replaces a pending choice and keeps the old one as cancelled', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const guard = await game.seat('guard');
    const ability = await game.ability(guard, 'guard_protect');
    const [a, b] = [other(game, guard), other(game, guard, other(game, guard))];

    const first = submitActionResponseSchema.parse((await submit(guard, { abilityInstanceId: ability, targetPlayerIds: [a.playerId] }).expect(200)).body);
    const second = submitActionResponseSchema.parse((await submit(guard, { abilityInstanceId: ability, targetPlayerIds: [b.playerId] }).expect(200)).body);
    expect(second.actionId).not.toBe(first.actionId);
    expect((await actionRows(ability)).map((r) => [r.status, r.target_player_ids])).toEqual([
      ['CANCELLED', [a.playerId]],
      ['PENDING', [b.playerId]],
    ]);
    expect((await mine(guard)).abilities[0]!.action?.actionId).toBe(second.actionId);
  });

  it('keeps one pending action when two different requests race', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const guard = await game.seat('guard');
    const ability = await game.ability(guard, 'guard_protect');
    const [a, b] = [other(game, guard), other(game, guard, other(game, guard))];
    const results = await Promise.all([
      submit(guard, { abilityInstanceId: ability, targetPlayerIds: [a.playerId] }),
      submit(guard, { abilityInstanceId: ability, targetPlayerIds: [b.playerId] }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await actionRows(ability)).filter((r) => r.status === 'PENDING')).toHaveLength(1);
  });

  it('locks the night\'s choices when the host closes submission, and refuses later ones', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const ability = await game.ability(seeker, 'seeker_investigate');
    const target = other(game, seeker);
    await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [target.playerId] }).expect(200);

    expect(await closePhase(game.host)).toBe('NIGHT_HOST_CONFIRM');
    expect((await actionRows(ability)).map((r) => r.status)).toEqual(['LOCKED']);

    const late = await submit(seeker, { abilityInstanceId: ability, targetPlayerIds: [other(game, seeker, target).playerId] }).expect(409);
    expect(errorOf(late.body).code).toBe('ACTION_WRONG_PHASE');
    expect((await mine(seeker)).abilities.find((a) => a.abilityInstanceId === ability)).toMatchObject({
      availability: 'NOT_THIS_PHASE',
      action: { status: 'LOCKED', targetPlayerIds: [target.playerId] },
    });
  });

  it('opens the informed Doctor in the reaction window, with no player ids', async () => {
    const game = await infectionGame();
    const doctor = await game.seat('doctor');
    const save = await game.ability(doctor, 'doctor_save');
    await closePhase(game.host);
    expect(errorOf((await submit(doctor, { abilityInstanceId: save }).expect(409)).body).code).toBe('ACTION_WRONG_PHASE');

    await closeUntil(game.host, 'NIGHT_REACTION');
    expect((await mine(doctor)).abilities[0]).toMatchObject({ availability: 'OPEN' });
    const named = await submit(doctor, { abilityInstanceId: save, targetPlayerIds: [doctor.playerId] }).expect(422);
    expect(errorOf(named.body)).toMatchObject({ code: 'ACTION_TARGET_ILLEGAL', issues: [{ path: 'targetPlayerIds' }] });
    const res = submitActionResponseSchema.parse((await submit(doctor, { abilityInstanceId: save }).expect(200)).body);
    expect(res).toMatchObject({ phase: 'NIGHT_REACTION', targetPlayerIds: [] });

    // Closing the reaction window locks the save and then resolves the night (WW-802).
    await closePhase(game.host);
    expect((await actionRows(save)).map((r) => r.status)).toEqual(['RESOLVED']);
  });

  it('treats another player\'s ability, or one from another game, as not found', async () => {
    const game = await infectionGame();
    const elsewhere = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const guard = await game.seat('guard');
    const villager = await game.seat('normal_villager');
    const target = [other(game, seeker, guard).playerId];

    const theirs = await submit(seeker, { abilityInstanceId: await game.ability(guard, 'guard_protect'), targetPlayerIds: target }).expect(404);
    expect(errorOf(theirs.body).code).toBe('NOT_FOUND');
    const foreignSeeker = await elsewhere.seat('seeker');
    await submit(seeker, { abilityInstanceId: await elsewhere.ability(foreignSeeker, 'seeker_investigate'), targetPlayerIds: target }).expect(404);
    await submit(villager, { abilityInstanceId: randomUUID(), targetPlayerIds: target }).expect(404);
    expect((await mine(villager)).abilities).toEqual([]);
  });

  it('refuses a dead actor, a revoked ability, and a spent potion', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const witch = await game.seat('witch');
    const target = [other(game, seeker, witch).playerId];
    const investigate = await game.ability(seeker, 'seeker_investigate');

    // An infected Seeker loses the ability (WW-701 will revoke it); the old ability is refused.
    await db.pool.query(`update ability_instances set status = 'REVOKED', revoked_reason = 'INFECTED' where id = $1`, [investigate]);
    expect(errorOf((await submit(seeker, { abilityInstanceId: investigate, targetPlayerIds: target }).expect(409)).body).code).toBe('ACTION_NOT_YOUR_ABILITY');

    const poison = await game.ability(witch, 'witch_poison');
    await submit(witch, { abilityInstanceId: poison, targetPlayerIds: target }).expect(200);
    await db.pool.query(`update ability_instances set charges_remaining = 0, status = 'EXHAUSTED' where id = $1`, [poison]);
    expect(errorOf((await submit(witch, { abilityInstanceId: poison, targetPlayerIds: target }).expect(409)).body).code).toBe('ACTION_NO_CHARGES');
    expect((await mine(witch)).abilities.find((a) => a.abilityId === 'witch_poison')?.availability).toBe('NO_USES');

    await db.pool.query(`update game_players set life_status = 'DEAD', died_round = 1 where id = $1`, [witch.playerId]);
    const save = await game.ability(witch, 'witch_save');
    expect(errorOf((await submit(witch, { abilityInstanceId: save, targetPlayerIds: target }).expect(409)).body).code).toBe('ACTION_DEAD');
  });

  it('checks targets by public facts only', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    const alpha = await game.seat('alpha_wolf');
    const dead = other(game, seeker, alpha);
    await db.pool.query(`update game_players set life_status = 'DEAD', died_round = 1 where id = $1`, [dead.playerId]);
    const investigate = await game.ability(seeker, 'seeker_investigate');

    const cases: [string[], string][] = [
      [[dead.playerId], 'That player cannot be chosen for this ability.'],
      [[seeker.playerId], 'This ability cannot target you.'],
      [[randomUUID()], 'That player is not in this game.'],
      [[], 'Choose the number of players this ability takes.'],
    ];
    for (const [targetPlayerIds, message] of cases) {
      const res = await submit(seeker, { abilityInstanceId: investigate, targetPlayerIds }).expect(422);
      expect(errorOf(res.body)).toMatchObject({ code: 'ACTION_TARGET_ILLEGAL', issues: [{ path: 'targetPlayerIds', message }] });
    }

    // The Alpha may name anyone alive. Refusing a wolf would tell the Alpha who the wolves are.
    const infect = await game.ability(alpha, 'alpha_infect');
    await submit(alpha, { abilityInstanceId: infect, targetPlayerIds: [seeker.playerId] }).expect(200);
  });

  it('stops the Guard protecting the same player on consecutive nights (WW-603)', async () => {
    const game = await infectionGame();
    const guard = await game.seat('guard');
    const protect = await game.ability(guard, 'guard_protect');
    const [kept, fresh] = [other(game, guard), other(game, guard, other(game, guard))];
    // Night 1's protection, as the resolver (WW-802) will record it.
    await db.pool.query(`update ability_instances set last_used_round = 1, last_target_player_id = $2, uses_consumed = 1 where id = $1`, [protect, kept.playerId]);

    await closeUntil(game.host, 'VOTING');
    await closePhase(game.host);
    const state = gameStateSchema.parse((await api().get(`/api/v1/games/${game.host.gameId}/state`).set(bearer(game.host)).expect(200)).body);
    expect(state).toMatchObject({ phase: 'NIGHT_SUBMIT', roundNumber: 2 });

    const repeat = await submit(guard, { abilityInstanceId: protect, targetPlayerIds: [kept.playerId] }).expect(422);
    expect(errorOf(repeat.body).issues?.[0]?.message).toBe('You chose that player last night. Choose someone else.');
    await submit(guard, { abilityInstanceId: protect, targetPlayerIds: [fresh.playerId] }).expect(200);
  });

  it('refuses everything once the game is cancelled', async () => {
    const game = await infectionGame();
    await closePhase(game.host);
    const seeker = await game.seat('seeker');
    await api().post(`/api/v1/games/${game.host.gameId}/host/cancel`).set(bearer(game.host)).expect(200);
    const res = await submit(seeker, { abilityInstanceId: await game.ability(seeker, 'seeker_investigate'), targetPlayerIds: [other(game, seeker).playerId] }).expect(409);
    expect(errorOf(res.body).code).toBe('ACTION_WRONG_PHASE');
  });
});

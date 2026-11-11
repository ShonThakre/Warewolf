import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { errorBodySchema, gameStateSchema, killTargetViewSchema, myActionsSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import { DEFAULT_CATALOG, getPack } from '@warewolf/domain';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-802: night resolution inside the phase close. The pure resolver is
 * tested in packages/domain; these check what reaches PostgreSQL, that a
 * night commits once, and that a failed write leaves the phase where it was.
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

interface Game {
  readonly host: SeatCredentials;
  readonly gameId: string;
  /** Every seat dealt this role, in player id order. */
  seats(roleId: string): Promise<SeatCredentials[]>;
  ability(seat: SeatCredentials, abilityId: string): Promise<string>;
}

async function startedGame(mode: 'INFECTION' | 'CLASSIC', players: number, packId?: string): Promise<Game> {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  if (packId) await api().put(`/api/v1/games/${host.gameId}/configuration`).set(bearer(host)).send(getPack(packId)!.config).expect(200);
  const all = [host];
  for (let i = 2; i <= players; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    all.push(seatCredentialsSchema.parse(joined.body));
  }
  await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
  await closeUntil(host, 'NIGHT_SUBMIT');
  return {
    host,
    gameId: host.gameId,
    async seats(roleId) {
      const { rows } = await db.pool.query<{ player_id: string }>(
        `select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id`,
        [host.gameId, roleId],
      );
      return rows.map((r) => all.find((s) => s.playerId === r.player_id)!);
    },
    async ability(seat, abilityId) {
      const { rows } = await db.pool.query<{ id: string }>(`select id from ability_instances where player_id = $1 and ability_id = $2 and source = 'NATIVE'`, [
        seat.playerId,
        abilityId,
      ]);
      return rows[0]!.id;
    },
  };
}

async function state(seat: SeatCredentials): Promise<GameState> {
  return gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat)).expect(200)).body);
}

const closeRaw = (host: SeatCredentials, stateVersion: number) => api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion });

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
  return gameStateSchema.parse((await closeRaw(host, current.stateVersion).expect(200)).body);
}

async function closeUntil(host: SeatCredentials, phase: GameState['phase']): Promise<GameState> {
  let current = await state(host);
  for (let i = 0; current.phase !== phase; i++) {
    if (i > 10) throw new Error(`never reached ${phase}`);
    current = await close(host);
  }
  return current;
}

async function act(game: Game, seat: SeatCredentials, abilityId: string, targets: SeatCredentials[] = []): Promise<string> {
  const abilityInstanceId = await game.ability(seat, abilityId);
  const res = await api()
    .post(`/api/v1/games/${game.gameId}/actions`)
    .set(bearer(seat))
    .set('Idempotency-Key', randomUUID())
    .send({ abilityInstanceId, targetPlayerIds: targets.map((t) => t.playerId) })
    .expect(200);
  return (res.body as { actionId: string }).actionId;
}

const count = async (table: string, gameId: string) =>
  (await db.pool.query<{ n: number }>(`select count(*)::int as n from ${table} where game_id = $1`, [gameId])).rows[0]!.n;

/** A Classic night where both Pack Wolves name the same villager and the Seeker checks a wolf. */
async function classicKill() {
  const game = await startedGame('CLASSIC', 10);
  const wolves = await game.seats('pack_wolf');
  const [seeker] = await game.seats('seeker');
  const [victim] = await game.seats('normal_villager');
  const kills = [await act(game, wolves[0]!, 'pack_kill', [victim!]), await act(game, wolves[1]!, 'pack_kill', [victim!])];
  const check = await act(game, seeker!, 'seeker_investigate', [wolves[0]!]);
  return { game, wolves, seeker: seeker!, victim: victim!, kills, check };
}

describe('night resolution in the phase close (WW-802)', () => {
  it('commits a Classic night: the death, its record, the private result, and every spent action', async () => {
    const { game, wolves, seeker, victim, kills, check } = await classicKill();
    const after = await close(game.host);
    expect(after).toMatchObject({ phase: 'DAY_ANNOUNCE', roundNumber: 1 });
    expect(after.players.find((p) => p.playerId === victim.playerId)?.lifeStatus).toBe('DEAD');

    const seat = await db.pool.query(`select life_status, died_round from game_players where id = $1`, [victim.playerId]);
    expect(seat.rows[0]).toEqual({ life_status: 'DEAD', died_round: 1 });

    const elimination = await db.pool.query(`select round_number, phase_kind, role_at_death, original_role_id, faction_at_death, causes, revealed_publicly from elimination_records where game_id = $1`, [game.gameId]);
    expect(elimination.rows).toEqual([
      {
        round_number: 1,
        phase_kind: 'NIGHT',
        role_at_death: 'normal_villager',
        original_role_id: 'normal_villager',
        faction_at_death: 'VILLAGE',
        causes: [{ type: 'WOLF_KILL', via: 'PACK', actorIds: wolves.map((w) => w.playerId).sort() }],
        revealed_publicly: true,
      },
    ]);

    const investigation = await db.pool.query(`select action_id, actor_player_id, kind, target_player_ids, result, published from investigation_records where game_id = $1`, [game.gameId]);
    expect(investigation.rows).toEqual([
      { action_id: check, actor_player_id: seeker.playerId, kind: 'ALIGNMENT_WOLF_OR_NOT', target_player_ids: [wolves[0]!.playerId], result: { value: 'WOLF' }, published: false },
    ]);

    const actions = await db.pool.query(`select id, status, rejected_reason from night_actions where game_id = $1 order by id`, [game.gameId]);
    expect(actions.rows).toEqual([...kills, check].sort().map((id) => ({ id, status: 'RESOLVED', rejected_reason: null })));

    const kill = await db.pool.query(`select uses_consumed, last_used_round, last_target_player_id from ability_instances where id = $1`, [await game.ability(wolves[0]!, 'pack_kill')]);
    expect(kill.rows[0]).toEqual({ uses_consumed: 1, last_used_round: 1, last_target_player_id: victim.playerId });

    const runs = await db.pool.query<{ round_number: number; phase_kind: string; input_hash: string; result: { deaths: unknown[] } }>(
      `select round_number, phase_kind, input_hash, result from resolution_runs where game_id = $1`,
      [game.gameId],
    );
    expect(runs.rows).toHaveLength(1);
    expect(runs.rows[0]).toMatchObject({ round_number: 1, phase_kind: 'NIGHT', result: { deaths: [{ playerId: victim.playerId }] } });
    expect(runs.rows[0]!.input_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('commits an Infection Edition night: the conversion, its records, the grant, and the counter', async () => {
    const game = await startedGame('INFECTION', 20);
    const [alpha] = await game.seats('alpha_wolf');
    const [seeker, target] = await game.seats('seeker');
    const infect = await act(game, alpha!, 'alpha_infect', [target!]);
    await act(game, seeker!, 'seeker_investigate', [target!]);
    await closeUntil(game.host, 'DAY_ANNOUNCE');

    const assignment = await db.pool.query(
      `select original_role_id, original_faction, current_role_id, current_profile_id, current_faction, wolf_aligned from role_assignments where player_id = $1`,
      [target!.playerId],
    );
    expect(assignment.rows[0]).toEqual({
      original_role_id: 'seeker',
      original_faction: 'VILLAGE',
      current_role_id: 'infected_wolf',
      current_profile_id: 'infected_wolf',
      current_faction: 'WOLF_PACK',
      wolf_aligned: true,
    });

    const abilities = await db.pool.query(`select ability_id, status, revoked_reason, available_from_round, source from ability_instances where player_id = $1 order by ability_id`, [target!.playerId]);
    expect(abilities.rows).toEqual([
      { ability_id: 'infected_kill', status: 'ACTIVE', revoked_reason: null, available_from_round: 2, source: 'NATIVE' },
      { ability_id: 'seeker_investigate', status: 'REVOKED', revoked_reason: 'INFECTION', available_from_round: 1, source: 'NATIVE' },
      { ability_id: 'seeker_public_reveal', status: 'REVOKED', revoked_reason: 'INFECTION', available_from_round: 1, source: 'NATIVE' },
    ]);

    const conversion = await db.pool.query(`select round_number, from_role_id, to_role_id, from_faction, to_faction, reason from role_conversion_records where player_id = $1`, [target!.playerId]);
    expect(conversion.rows).toEqual([{ round_number: 1, from_role_id: 'seeker', to_role_id: 'infected_wolf', from_faction: 'VILLAGE', to_faction: 'WOLF_PACK', reason: 'INFECTION' }]);

    const infection = await db.pool.query(`select action_id, source_player_id, previous_role_id, outcome, failure_reason from infection_records where game_id = $1`, [game.gameId]);
    expect(infection.rows).toEqual([{ action_id: infect, source_player_id: alpha!.playerId, previous_role_id: 'seeker', outcome: 'SUCCESS', failure_reason: null }]);

    const counter = await db.pool.query(`select infection_successes, infection_sealed from games where id = $1`, [game.gameId]);
    expect(counter.rows[0]).toEqual({ infection_successes: 1, infection_sealed: false });

    // The check read the start of the night (OD-38).
    const result = await db.pool.query(`select result from investigation_records where actor_player_id = $1`, [seeker!.playerId]);
    expect(result.rows).toEqual([{ result: { value: 'NOT_WOLF' } }]);
    // Nobody is shown the conversion.
    expect((await state(game.host)).players.every((p) => p.lifeStatus === 'ALIVE')).toBe(true);
  });

  it('carries an Avenger\'s revenge to the next night and lands it there', async () => {
    const game = await startedGame('CLASSIC', 15, 'chaos-15');
    const [lone] = await game.seats('lone_wolf');
    const [avenger] = await game.seats('avenger');
    await act(game, lone!, 'lone_kill', [avenger!]);
    await closeUntil(game.host, 'DAY_ANNOUNCE');

    const queued = await db.pool.query(`select kind, source_player_id, target_player_id, created_round, due_round, due_phase, attack_types, status from scheduled_effects where game_id = $1`, [game.gameId]);
    expect(queued.rows).toEqual([
      { kind: 'REVENGE', source_player_id: avenger!.playerId, target_player_id: lone!.playerId, created_round: 1, due_round: 2, due_phase: 'NIGHT', attack_types: ['REVENGE'], status: 'ACTIVE' },
    ]);

    await closeUntil(game.host, 'NIGHT_SUBMIT');
    expect((await state(game.host)).roundNumber).toBe(2);
    await closeUntil(game.host, 'DAY_ANNOUNCE');
    const landed = await db.pool.query(`select status, closed_round from scheduled_effects where game_id = $1`, [game.gameId]);
    expect(landed.rows).toEqual([{ status: 'SPENT', closed_round: 2 }]);
    const deaths = await db.pool.query(`select player_id, round_number, causes from elimination_records where game_id = $1 order by round_number`, [game.gameId]);
    expect(deaths.rows).toEqual([
      { player_id: avenger!.playerId, round_number: 1, causes: [{ type: 'WOLF_KILL', via: 'ABILITY', actorIds: [lone!.playerId] }] },
      { player_id: lone!.playerId, round_number: 2, causes: [{ type: 'REVENGE', via: 'EFFECT', actorIds: [avenger!.playerId] }] },
    ]);
    expect(await count('resolution_runs', game.gameId)).toBe(2);
  });
});

describe('one commit per night (WW-802 acceptance)', () => {
  it('two racing closes resolve the night once', async () => {
    const { game } = await classicKill();
    const { stateVersion } = await state(game.host);
    const results = await Promise.all([closeRaw(game.host, stateVersion), closeRaw(game.host, stateVersion)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await count('resolution_runs', game.gameId)).toBe(1);
    expect(await count('elimination_records', game.gameId)).toBe(1);
  });

  it('refuses a second resolve of the same night even if the phase is forced back, and changes nothing', async () => {
    const { game, victim } = await classicKill();
    await close(game.host);
    // Simulate a lost update: the game row claims the night is open again.
    await db.pool.query(`update games set phase = 'NIGHT_SUBMIT', phase_ends_at = null where id = $1`, [game.gameId]);
    const before = await state(game.host);

    const res = await closeRaw(game.host, before.stateVersion).expect(409);
    expect(errorCode(res.body)).toBe('PHASE_CONFLICT');
    const after = await state(game.host);
    expect(after).toMatchObject({ phase: 'NIGHT_SUBMIT', stateVersion: before.stateVersion });
    expect(await count('resolution_runs', game.gameId)).toBe(1);
    expect(await count('elimination_records', game.gameId)).toBe(1);
    expect(after.players.find((p) => p.playerId === victim.playerId)?.lifeStatus).toBe('DEAD');
  });

  it('the unique run key stops a duplicate that gets past the check', async () => {
    const { game } = await classicKill();
    await close(game.host);
    await expect(
      db.pool.query(`insert into resolution_runs (game_id, round_number, phase_kind, input_hash, result) values ($1, 1, 'NIGHT', 'x', '{}'::jsonb)`, [game.gameId]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rolls the whole close back when a write fails, and the retry commits', async () => {
    const { game, victim, kills } = await classicKill();
    // A stray record for the victim makes the death insert fail halfway through the writes.
    await db.pool.query(
      `insert into elimination_records (game_id, round_number, phase_kind, player_id, role_at_death, original_role_id, faction_at_death, causes, revealed_publicly)
       values ($1, 1, 'DAY', $2, 'normal_villager', 'normal_villager', 'VILLAGE', '[]'::jsonb, false)`,
      [game.gameId, victim.playerId],
    );
    const before = await state(game.host);
    await closeRaw(game.host, before.stateVersion).expect(500);

    const after = await state(game.host);
    expect(after).toMatchObject({ phase: 'NIGHT_SUBMIT', stateVersion: before.stateVersion });
    expect(after.players.find((p) => p.playerId === victim.playerId)?.lifeStatus).toBe('ALIVE');
    expect(await count('resolution_runs', game.gameId)).toBe(0);
    const statuses = await db.pool.query(`select status from night_actions where id = any($1::uuid[])`, [kills]);
    expect(statuses.rows.map((r) => r.status)).toEqual(['PENDING', 'PENDING']);

    await db.pool.query(`delete from elimination_records where game_id = $1`, [game.gameId]);
    expect((await close(game.host)).phase).toBe('DAY_ANNOUNCE');
    expect(await count('resolution_runs', game.gameId)).toBe(1);
  });
});

describe('host kill target (WW-803)', () => {
  const killTarget = (seat: SeatCredentials) => api().get(`/api/v1/games/${seat.gameId}/host/kill-target`).set(bearer(seat));
  const choose = (seat: SeatCredentials, body: object) => api().post(`/api/v1/games/${seat.gameId}/host/kill-target`).set(bearer(seat)).send(body);
  const doctorRow = async (doctor: SeatCredentials) =>
    myActionsSchema.parse((await api().get(`/api/v1/games/${doctor.gameId}/me/actions`).set(bearer(doctor)).expect(200)).body).abilities[0]!;

  /** An Infection night where the Alpha and one Infected Wolf name different players, at host confirm. */
  async function hostConfirm() {
    const game = await startedGame('INFECTION', 20);
    const [alpha] = await game.seats('alpha_wolf');
    const [doctor] = await game.seats('doctor');
    const villagers = await game.seats('normal_villager');
    const [first, second, unnamed] = villagers;
    await act(game, alpha!, 'alpha_kill', [first!]);
    // A second wolf: give a villager the Infected Wolf's place directly, as a conversion would.
    const wolf = villagers[3]!;
    await db.pool.query(`update role_assignments set current_role_id = 'infected_wolf', current_profile_id = 'infected_wolf', current_faction = 'WOLF_PACK', wolf_aligned = true where player_id = $1`, [wolf.playerId]);
    await db.pool.query(
      `insert into ability_instances (game_id, player_id, assignment_id, ability_id, capability, available_from_round, source, config)
       select game_id, player_id, id, 'infected_kill', 'KILL', 1, 'NATIVE', $2::jsonb from role_assignments where player_id = $1`,
      [wolf.playerId, JSON.stringify(DEFAULT_CATALOG.byId.get('infected_wolf')!.profiles['infected_wolf']!.abilities[0])],
    );
    await act(game, wolf, 'infected_kill', [second!]);
    await closeUntil(game.host, 'NIGHT_HOST_CONFIRM');
    return { game, alpha: alpha!, wolf, doctor: doctor!, first: first!, second: second!, unnamed: unnamed! };
  }

  it('lists the named players with their wolves, to the host only', async () => {
    const { game, alpha, wolf, first, second } = await hostConfirm();
    const view = killTargetViewSchema.parse((await killTarget(game.host).expect(200)).body);
    expect(view).toMatchObject({ phase: 'NIGHT_HOST_CONFIRM', roundNumber: 1, decision: null, editable: true });
    expect(view.candidates).toEqual(
      [
        { playerId: first.playerId, submittedBy: [alpha.playerId] },
        { playerId: second.playerId, submittedBy: [wolf.playerId] },
      ].sort((a, b) => (a.playerId < b.playerId ? -1 : 1)),
    );
    expect(errorCode((await killTarget(alpha).expect(403)).body)).toBe('NOT_HOST');
    expect(errorCode((await choose(alpha, { noKill: true }).expect(403)).body)).toBe('NOT_HOST');
  });

  it('refuses a player no wolf named, and host confirm cannot close without a choice', async () => {
    const { game, unnamed } = await hostConfirm();
    const refused = await choose(game.host, { targetPlayerId: unnamed.playerId }).expect(422);
    expect(errorBodySchema.parse(refused.body).error).toMatchObject({ code: 'KILL_TARGET_NOT_SUBMITTED', issues: [{ path: 'targetPlayerId' }] });
    expect(errorCode((await choose(game.host, { noKill: false }).expect(422)).body)).toBe('VALIDATION_FAILED');

    const before = await state(game.host);
    expect(errorCode((await closeRaw(game.host, before.stateVersion).expect(409)).body)).toBe('KILL_TARGET_REQUIRED');
    expect(await state(game.host)).toMatchObject({ phase: 'NIGHT_HOST_CONFIRM', stateVersion: before.stateVersion });
  });

  it('is open only during host confirm, and replaceable until it closes', async () => {
    const { game, first, second } = await hostConfirm();
    await choose(game.host, { targetPlayerId: first.playerId }).expect(200);
    const replaced = killTargetViewSchema.parse((await choose(game.host, { targetPlayerId: second.playerId }).expect(200)).body);
    expect(replaced.decision).toEqual({ kind: 'TARGET', playerId: second.playerId });

    expect((await close(game.host)).phase).toBe('NIGHT_REACTION');
    expect(killTargetViewSchema.parse((await killTarget(game.host).expect(200)).body)).toMatchObject({ editable: false, decision: { kind: 'TARGET', playerId: second.playerId } });
    expect(errorCode((await choose(game.host, { noKill: true }).expect(409)).body)).toBe('PHASE_CONFLICT');
  });

  it('shows the informed Doctor the confirmed target, and the night kills them when the Doctor declines', async () => {
    const { game, doctor, first } = await hostConfirm();
    await choose(game.host, { targetPlayerId: first.playerId }).expect(200);
    expect(await doctorRow(doctor)).not.toHaveProperty('finalWolfTarget');
    await close(game.host);

    expect(await doctorRow(doctor)).toMatchObject({ availability: 'OPEN', finalWolfTarget: first.playerId });
    await closeUntil(game.host, 'DAY_ANNOUNCE');
    expect((await state(game.host)).players.find((p) => p.playerId === first.playerId)?.lifeStatus).toBe('DEAD');
    const elimination = await db.pool.query(`select causes from elimination_records where game_id = $1`, [game.gameId]);
    expect(elimination.rows[0].causes).toMatchObject([{ type: 'WOLF_KILL', via: 'PACK' }]);
  });

  it('lets the informed Doctor save the confirmed target', async () => {
    const { game, doctor, first } = await hostConfirm();
    await choose(game.host, { targetPlayerId: first.playerId }).expect(200);
    await close(game.host);
    await act(game, doctor, 'doctor_save');
    await closeUntil(game.host, 'DAY_ANNOUNCE');
    expect((await state(game.host)).players.every((p) => p.lifeStatus === 'ALIVE')).toBe(true);
  });

  it('tells the Doctor there is no attack when the host chose no kill', async () => {
    const { game, doctor } = await hostConfirm();
    await choose(game.host, { noKill: true }).expect(200);
    await close(game.host);
    expect(await doctorRow(doctor)).toMatchObject({ finalWolfTarget: null });
    await closeUntil(game.host, 'DAY_ANNOUNCE');
    expect(await count('elimination_records', game.gameId)).toBe(0);
  });
});

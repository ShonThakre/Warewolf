import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateUp, rollbackLast } from '../src/db/migrations.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

let db: TestDatabase;
let pool: Pool;

async function tableExists(name: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(`select to_regclass($1) is not null as exists`, [`public.${name}`]);
  return res.rows[0]?.exists ?? false;
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** A game and its host seat, inserted together as the lobby service does. A started game is in round 1. */
async function createGame(roomCode: string, status = 'LOBBY', mode = 'INFECTION', phase?: string) {
  const gameId = randomUUID();
  const hostId = randomUUID();
  const round = status === 'LOBBY' ? 0 : 1;
  await inTransaction(async (client) => {
    await client.query(
      `insert into games (id, room_code, status, host_player_id, mode, round_number${phase ? ', phase' : ''}) values ($1, $2, $3, $4, $5, $6${phase ? ', $7' : ''})`,
      phase ? [gameId, roomCode, status, hostId, mode, round, phase] : [gameId, roomCode, status, hostId, mode, round],
    );
    await client.query(
      `insert into game_players (id, game_id, display_name, seat_number, avatar_id, is_host, token_hash) values ($1, $2, 'Host', 1, 1, true, $3)`,
      [hostId, gameId, randomUUID()],
    );
  });
  return { gameId, hostId };
}

/** Before 0002_avatars there is no avatar_id column. */
async function createGameWithoutAvatars(roomCode: string) {
  const gameId = randomUUID();
  const hostId = randomUUID();
  await inTransaction(async (client) => {
    await client.query(`insert into games (id, room_code, host_player_id, mode) values ($1, $2, $3, 'CLASSIC')`, [gameId, roomCode, hostId]);
    await client.query(
      `insert into game_players (id, game_id, display_name, seat_number, is_host, token_hash) values ($1, $2, 'Host', 1, true, $3)`,
      [hostId, gameId, randomUUID()],
    );
  });
  return { gameId, hostId };
}

const addSeat = (gameId: string, displayName: string, seat: number, extra: { isHost?: boolean; tokenHash?: string; avatarId?: number } = {}) =>
  pool.query(
    `insert into game_players (game_id, display_name, seat_number, avatar_id, is_host, token_hash) values ($1, $2, $3, $4, $5, $6)`,
    [gameId, displayName, seat, extra.avatarId ?? seat, extra.isHost ?? false, extra.tokenHash ?? randomUUID()],
  );

const assign = (gameId: string, playerId: string, roleId = 'seeker', faction = 'VILLAGE') =>
  pool.query<{ id: string }>(
    `insert into role_assignments
       (game_id, player_id, original_role_id, original_profile_id, original_faction, current_role_id, current_profile_id, current_faction, wolf_aligned)
     values ($1, $2, $3, $3, $4, $3, $3, $4, false) returning id`,
    [gameId, playerId, roleId, faction],
  );

/** A started game whose host seat holds a Seeker. */
async function dealtGame(roomCode: string) {
  const { gameId, hostId } = await createGame(roomCode, 'ACTIVE', 'INFECTION', 'ROLE_REVEAL');
  const { rows } = await assign(gameId, hostId);
  return { gameId, hostId, assignmentId: rows[0]!.id };
}

const addAbility = (
  g: { gameId: string; hostId: string; assignmentId: string },
  abilityId: string,
  extra: { source?: string; status?: string; charges?: number | null; capability?: string | null } = {},
) =>
  pool.query(
    `insert into ability_instances (game_id, player_id, assignment_id, ability_id, capability, status, charges_remaining, available_from_round, source, config)
     values ($1, $2, $3, $4, $5, $6, $7, 1, $8, '{}'::jsonb)`,
    [g.gameId, g.hostId, g.assignmentId, abilityId, extra.capability === undefined ? 'INVESTIGATE' : extra.capability, extra.status ?? 'ACTIVE', extra.charges ?? null, extra.source ?? 'NATIVE'],
  );

beforeAll(async () => {
  db = await createTestDatabase({ migrate: false });
  pool = db.pool;
});

afterAll(async () => {
  await db?.drop();
});

describe('migrations', () => {
  it('create games and game_players with lobby defaults', async () => {
    await migrateUp(pool);
    expect(await tableExists('games')).toBe(true);
    expect(await tableExists('game_players')).toBe(true);
    expect(await tableExists('role_assignments')).toBe(true);
    expect(await tableExists('ability_instances')).toBe(true);

    const { gameId } = await createGame('ABCDEF');
    const game = await pool.query(
      `select status, phase, round_number, state_version, config_draft, config_snapshot, phase_ends_at, cancel_reason from games where id = $1`,
      [gameId],
    );
    expect(game.rows[0]).toEqual({
      status: 'LOBBY',
      phase: 'LOBBY',
      round_number: 0,
      state_version: 0,
      config_draft: {},
      config_snapshot: null,
      phase_ends_at: null,
      cancel_reason: null,
    });
    const seat = await pool.query(`select life_status, connection_status, died_round from game_players where game_id = $1`, [gameId]);
    expect(seat.rows[0]).toEqual({ life_status: 'ALIVE', connection_status: 'DISCONNECTED', died_round: null });
  });

  it('are idempotent when re-applied', async () => {
    await expect(migrateUp(pool)).resolves.toBeUndefined();
  });
});

describe('games', () => {
  it('keeps room codes unique only among open games', async () => {
    await expect(createGame('ABCDEF')).rejects.toMatchObject({ code: '23505' });
    await expect(createGame('ABCDEF', 'ACTIVE', 'INFECTION', 'ROLE_REVEAL')).rejects.toMatchObject({ code: '23505' });
    await expect(createGame('ABCDEF', 'FINISHED', 'INFECTION', 'FINISHED')).resolves.toBeDefined();
    await expect(createGame('ABCDEF', 'CANCELLED', 'INFECTION', 'CANCELLED')).resolves.toBeDefined();
  });

  it('rejects values outside the domain enumerations', async () => {
    await expect(createGame('ZZZZZZ', 'PAUSED')).rejects.toMatchObject({ code: '23514' });
    await expect(createGame('YYYYYY', 'LOBBY', 'BATTLE_ROYALE')).rejects.toMatchObject({ code: '23514' });
    await expect(createGame('XXXXXX', 'LOBBY', 'CLASSIC', 'DUSK')).rejects.toMatchObject({ code: '23514' });
    await expect(createGame('SHORT')).rejects.toMatchObject({ code: '23514' });
  });

  it('requires the host seat to exist when the transaction commits', async () => {
    await expect(
      pool.query(`insert into games (room_code, host_player_id, mode) values ('NOHOST', $1, 'CLASSIC')`, [randomUUID()]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('accepts only known cancel reasons', async () => {
    const { gameId } = await createGame('CANCEL');
    await expect(pool.query(`update games set cancel_reason = 'BORED' where id = $1`, [gameId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`update games set cancel_reason = 'HOST' where id = $1`, [gameId])).resolves.toBeDefined();
  });

  it('has the recovery-scan and deadline indexes', async () => {
    const res = await pool.query<{ indexname: string }>(`select indexname from pg_indexes where tablename = 'games'`);
    expect(res.rows.map((r) => r.indexname).sort()).toEqual(['games_phase_deadline_idx', 'games_pkey', 'games_room_code_open_uq', 'games_status_phase_idx']);
  });

  it('keeps status and phase in agreement', async () => {
    await expect(createGame('MIXUP1', 'LOBBY', 'CLASSIC', 'NIGHT_SUBMIT')).rejects.toMatchObject({ code: '23514' });
    await expect(createGame('MIXUP2', 'ACTIVE', 'CLASSIC', 'LOBBY')).rejects.toMatchObject({ code: '23514' });
    await expect(createGame('MIXUP3', 'ACTIVE', 'CLASSIC', 'FINISHED')).rejects.toMatchObject({ code: '23514' });
    await expect(createGame('MIXUP4', 'FINISHED', 'CLASSIC', 'VOTING')).rejects.toMatchObject({ code: '23514' });
    const { gameId } = await createGame('MIXUP5', 'ACTIVE', 'CLASSIC', 'VOTING');
    await expect(pool.query(`update games set status = 'CANCELLED' where id = $1`, [gameId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`update games set status = 'CANCELLED', phase = 'CANCELLED' where id = $1`, [gameId])).resolves.toBeDefined();
  });

  it('keeps round 0 for the lobby and round 1 or later once started', async () => {
    const { gameId } = await createGame('ROUNDS');
    await expect(pool.query(`update games set round_number = 1 where id = $1`, [gameId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`update games set status = 'ACTIVE', phase = 'ROLE_REVEAL' where id = $1`, [gameId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`update games set status = 'ACTIVE', phase = 'ROLE_REVEAL', round_number = 1 where id = $1`, [gameId])).resolves.toBeDefined();
  });

  it('allows a deadline only on an active game', async () => {
    const lobby = await createGame('NODEAD');
    await expect(pool.query(`update games set phase_ends_at = now() where id = $1`, [lobby.gameId])).rejects.toMatchObject({ code: '23514' });
    const active = await createGame('TIMED1', 'ACTIVE', 'CLASSIC', 'NIGHT_SUBMIT');
    await expect(pool.query(`update games set phase_ends_at = now() + interval '90 seconds' where id = $1`, [active.gameId])).resolves.toBeDefined();
    await expect(pool.query(`update games set status = 'FINISHED', phase = 'FINISHED' where id = $1`, [active.gameId])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('game_players', () => {
  it('keeps display names unique per game, ignoring case', async () => {
    const { gameId } = await createGame('NAMES1');
    await addSeat(gameId, 'Rafi', 2);
    await expect(addSeat(gameId, 'rafi', 3)).rejects.toMatchObject({ code: '23505' });
    const other = await createGame('NAMES2');
    await expect(addSeat(other.gameId, 'Rafi', 2)).resolves.toBeDefined();
  });

  it('keeps seat numbers unique per game and starting at 1', async () => {
    const { gameId } = await createGame('SEATS1');
    await expect(addSeat(gameId, 'Second', 1)).rejects.toMatchObject({ code: '23505' });
    await expect(addSeat(gameId, 'Zero', 0)).rejects.toMatchObject({ code: '23514' });
  });

  it('allows one host per game', async () => {
    const { gameId } = await createGame('HOSTS1');
    await expect(addSeat(gameId, 'Usurper', 2, { isHost: true })).rejects.toMatchObject({ code: '23505' });
  });

  it('keeps token hashes globally unique', async () => {
    const a = await createGame('TOKEN1');
    const b = await createGame('TOKEN2');
    await addSeat(a.gameId, 'Same', 2, { tokenHash: 'h' });
    await expect(addSeat(b.gameId, 'Same', 2, { tokenHash: 'h' })).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces display name length', async () => {
    const { gameId } = await createGame('LENGTH');
    await expect(addSeat(gameId, 'A', 2)).rejects.toMatchObject({ code: '23514' });
    await expect(addSeat(gameId, 'x'.repeat(25), 3)).rejects.toMatchObject({ code: '23514' });
  });

  it('keeps avatars unique per game and between 1 and 36', async () => {
    const { gameId } = await createGame('AVATAR');
    await expect(addSeat(gameId, 'Copycat', 2, { avatarId: 1 })).rejects.toMatchObject({ code: '23505' });
    await expect(addSeat(gameId, 'Zero', 3, { avatarId: 0 })).rejects.toMatchObject({ code: '23514' });
    await expect(addSeat(gameId, 'Big', 4, { avatarId: 37 })).rejects.toMatchObject({ code: '23514' });
    const other = await createGame('AVATR2');
    await expect(addSeat(other.gameId, 'Twin', 2, { avatarId: 2 })).resolves.toBeDefined();
  });

  it('deletes seats with their game', async () => {
    const { gameId } = await createGame('DELETE');
    await addSeat(gameId, 'Guest', 2);
    await pool.query(`delete from games where id = $1`, [gameId]);
    const left = await pool.query(`select count(*)::int as n from game_players where game_id = $1`, [gameId]);
    expect(left.rows[0]).toEqual({ n: 0 });
  });
});

describe('role_assignments', () => {
  it('starts with no individual victory and no public reveal', async () => {
    const { assignmentId } = await dealtGame('DEALT1');
    const { rows } = await pool.query(`select individual_victory, public_reveal, mark_target_player_id from role_assignments where id = $1`, [assignmentId]);
    expect(rows[0]).toEqual({ individual_victory: 'NONE', public_reveal: false, mark_target_player_id: null });
  });

  it.each([
    ['original_role_id', `'alpha_wolf'`, 'IMMUT1'],
    ['original_profile_id', `'doctor_infection'`, 'IMMUT2'],
    ['original_faction', `'WOLF_PACK'`, 'IMMUT3'],
    ['player_id', 'gen_random_uuid()', 'IMMUT4'],
    ['game_id', 'gen_random_uuid()', 'IMMUT5'],
  ])('refuses to change %s once dealt', async (column, value, roomCode) => {
    const { assignmentId } = await dealtGame(roomCode);
    await expect(pool.query(`update role_assignments set ${column} = ${value} where id = $1`, [assignmentId])).rejects.toMatchObject({
      code: '23001',
    });
  });

  it('lets the current role change while the original stays', async () => {
    const { assignmentId } = await dealtGame('CONVRT');
    await pool.query(
      `update role_assignments set current_role_id = 'infected_wolf', current_profile_id = 'infected_wolf', current_faction = 'WOLF_PACK', wolf_aligned = true where id = $1`,
      [assignmentId],
    );
    const { rows } = await pool.query(`select original_role_id, original_faction, current_role_id, current_faction from role_assignments where id = $1`, [assignmentId]);
    expect(rows[0]).toEqual({ original_role_id: 'seeker', original_faction: 'VILLAGE', current_role_id: 'infected_wolf', current_faction: 'WOLF_PACK' });
  });

  it('allows one assignment per player', async () => {
    const { gameId, hostId } = await dealtGame('ONEPER');
    await expect(assign(gameId, hostId, 'guard')).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects unknown factions and victory states', async () => {
    const { gameId, hostId } = await createGame('FACTN1', 'ACTIVE', 'INFECTION', 'ROLE_REVEAL');
    await expect(assign(gameId, hostId, 'seeker', 'VAMPIRES')).rejects.toMatchObject({ code: '23514' });
    const { assignmentId } = await dealtGame('FACTN2');
    await expect(pool.query(`update role_assignments set individual_victory = 'MAYBE' where id = $1`, [assignmentId])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('ability_instances', () => {
  it('keeps one native instance per ability on an assignment, while copies may repeat it', async () => {
    const g = await dealtGame('NATIVE');
    await addAbility(g, 'seeker_investigate');
    await expect(addAbility(g, 'seeker_investigate')).rejects.toMatchObject({ code: '23505' });
    await expect(addAbility(g, 'seeker_investigate', { source: 'COPY' })).resolves.toBeDefined();
  });

  it('allows a handler-only ability with no capability', async () => {
    await expect(addAbility(await dealtGame('HANDLR'), 'assassin_mark', { capability: null })).resolves.toBeDefined();
  });

  it('rejects values outside the domain enumerations and negative charges', async () => {
    const g = await dealtGame('ABILCK');
    await expect(addAbility(g, 'a1', { status: 'SLEEPING' })).rejects.toMatchObject({ code: '23514' });
    await expect(addAbility(g, 'a2', { source: 'STOLEN' })).rejects.toMatchObject({ code: '23514' });
    await expect(addAbility(g, 'a3', { capability: 'FLY' })).rejects.toMatchObject({ code: '23514' });
    await expect(addAbility(g, 'a4', { charges: -1 })).rejects.toMatchObject({ code: '23514' });
  });

  it('deletes assignments and abilities with their game', async () => {
    const g = await dealtGame('CASCAD');
    await addAbility(g, 'seeker_investigate');
    await pool.query(`delete from games where id = $1`, [g.gameId]);
    const left = await pool.query(
      `select (select count(*)::int from role_assignments where game_id = $1) as assignments, (select count(*)::int from ability_instances where game_id = $1) as abilities`,
      [g.gameId],
    );
    expect(left.rows[0]).toEqual({ assignments: 0, abilities: 0 });
  });
});

describe('night_actions', () => {
  async function action(g: { gameId: string; hostId: string }, abilityId: string, extra: { status?: string; phase?: string; round?: number } = {}) {
    return pool.query(
      `insert into night_actions (game_id, round_number, phase, player_id, ability_instance_id, status, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [g.gameId, extra.round ?? 1, extra.phase ?? 'NIGHT_SUBMIT', g.hostId, abilityId, extra.status ?? 'PENDING', randomUUID()],
    );
  }

  it('keeps one open action per ability per round, and any number cancelled', async () => {
    const g = await dealtGame('ACTS01');
    const { rows } = await addAbility(g, 'seeker_investigate').then(() =>
      pool.query<{ id: string }>(`select id from ability_instances where assignment_id = $1`, [g.assignmentId]),
    );
    const abilityId = rows[0]!.id;
    await action(g, abilityId);
    await expect(action(g, abilityId)).rejects.toMatchObject({ code: '23505' });
    await expect(action(g, abilityId, { status: 'CANCELLED' })).resolves.toBeDefined();
    await expect(action(g, abilityId, { status: 'CANCELLED' })).resolves.toBeDefined();
    await expect(action(g, abilityId, { round: 2 })).resolves.toBeDefined();
    await pool.query(`update night_actions set status = 'LOCKED' where ability_instance_id = $1 and round_number = 1 and status = 'PENDING'`, [abilityId]);
    await expect(action(g, abilityId)).rejects.toMatchObject({ code: '23505' });
  });

  it('accepts only known statuses, action windows, and started rounds', async () => {
    const g = await dealtGame('ACTS02');
    await addAbility(g, 'seeker_investigate');
    const { rows } = await pool.query<{ id: string }>(`select id from ability_instances where assignment_id = $1`, [g.assignmentId]);
    const abilityId = rows[0]!.id;
    await expect(action(g, abilityId, { status: 'MAYBE' })).rejects.toMatchObject({ code: '23514' });
    await expect(action(g, abilityId, { phase: 'VOTING' })).rejects.toMatchObject({ code: '23514' });
    await expect(action(g, abilityId, { round: 0 })).rejects.toMatchObject({ code: '23514' });
  });

  it('scopes idempotency keys to the seat', async () => {
    const g = await dealtGame('ACTS03');
    await addSeat(g.gameId, 'Guest', 2);
    const { rows } = await pool.query<{ id: string }>(`select id from game_players where game_id = $1 and seat_number = 2`, [g.gameId]);
    const insert = (playerId: string) =>
      pool.query(`insert into idempotency_keys (game_id, player_id, key, request_hash, response) values ($1, $2, 'same-key-1', 'h', '{}'::jsonb)`, [g.gameId, playerId]);
    await insert(g.hostId);
    await expect(insert(g.hostId)).rejects.toMatchObject({ code: '23505' });
    await expect(insert(rows[0]!.id)).resolves.toBeDefined();
  });
});

describe('0002_avatars on existing data', () => {
  it('gives seats that predate avatars their seat number as avatar', async () => {
    expect(await rollbackLast(pool)).toBe('0009_ultimate_20');
    expect(await rollbackLast(pool)).toBe('0008_votes');
    expect(await tableExists('votes')).toBe(false);
    expect(await tableExists('victory_records')).toBe(false);
    expect(await rollbackLast(pool)).toBe('0007_kill_decisions');
    expect(await rollbackLast(pool)).toBe('0006_night_resolution');
    expect(await rollbackLast(pool)).toBe('0005_night_actions');
    expect(await rollbackLast(pool)).toBe('0004_phase_machine');
    expect(await rollbackLast(pool)).toBe('0003_assignments');
    expect(await rollbackLast(pool)).toBe('0002_avatars');
    const { gameId } = await createGameWithoutAvatars('LEGACY');
    await pool.query(`insert into game_players (game_id, display_name, seat_number, token_hash) values ($1, 'Guest', 2, $2)`, [gameId, randomUUID()]);
    await migrateUp(pool);
    const { rows } = await pool.query(`select seat_number, avatar_id from game_players where game_id = $1 order by seat_number`, [gameId]);
    expect(rows).toEqual([
      { seat_number: 1, avatar_id: 1 },
      { seat_number: 2, avatar_id: 2 },
    ]);
  });
});

describe('rollback', () => {
  it('reverts one migration at a time, then rolls forward again', async () => {
    expect(await rollbackLast(pool)).toBe('0009_ultimate_20');
    expect(await rollbackLast(pool)).toBe('0008_votes');
    expect(await tableExists('votes')).toBe(false);
    expect(await tableExists('victory_records')).toBe(false);
    expect(await rollbackLast(pool)).toBe('0007_kill_decisions');
    expect(await tableExists('night_kill_decisions')).toBe(false);
    expect(await rollbackLast(pool)).toBe('0006_night_resolution');
    for (const table of ['resolution_runs', 'elimination_records', 'infection_records', 'investigation_records', 'role_conversion_records', 'scheduled_effects']) {
      expect(await tableExists(table)).toBe(false);
    }
    const added = await pool.query(
      `select column_name from information_schema.columns where (table_name = 'games' and column_name in ('infection_successes', 'infection_sealed')) or (table_name = 'night_actions' and column_name = 'rejected_reason')`,
    );
    expect(added.rows).toEqual([]);
    expect(await rollbackLast(pool)).toBe('0005_night_actions');
    expect(await tableExists('night_actions')).toBe(false);
    expect(await tableExists('idempotency_keys')).toBe(false);
    expect(await rollbackLast(pool)).toBe('0004_phase_machine');
    const constraints = await pool.query(`select conname from pg_constraint where conname in ('games_phase_status_ck', 'games_round_status_ck', 'games_deadline_ck')`);
    expect(constraints.rows).toEqual([]);
    const deadlineIndex = await pool.query(`select to_regclass('public.games_phase_deadline_idx') is null as gone`);
    expect(deadlineIndex.rows[0]).toEqual({ gone: true });
    expect(await rollbackLast(pool)).toBe('0003_assignments');
    expect(await tableExists('role_assignments')).toBe(false);
    expect(await tableExists('ability_instances')).toBe(false);
    const fn = await pool.query(`select to_regprocedure('role_assignments_keep_original()') is null as gone`);
    expect(fn.rows[0]).toEqual({ gone: true });
    expect(await rollbackLast(pool)).toBe('0002_avatars');
    const columns = await pool.query(`select column_name from information_schema.columns where table_name = 'game_players' and column_name = 'avatar_id'`);
    expect(columns.rows).toEqual([]);
    expect(await rollbackLast(pool)).toBe('0001_lobby');
    expect(await tableExists('game_players')).toBe(false);
    expect(await tableExists('games')).toBe(true);
    expect(await rollbackLast(pool)).toBe('0000_games');
    expect(await tableExists('games')).toBe(false);
    expect(await rollbackLast(pool)).toBeNull();

    await migrateUp(pool);
    expect(await tableExists('games')).toBe(true);
    expect(await tableExists('game_players')).toBe(true);
    expect(await tableExists('role_assignments')).toBe(true);
    expect(await tableExists('ability_instances')).toBe(true);
    expect(await tableExists('night_actions')).toBe(true);
    expect(await tableExists('idempotency_keys')).toBe(true);
    expect(await tableExists('resolution_runs')).toBe(true);
    expect(await tableExists('scheduled_effects')).toBe(true);
    expect(await tableExists('night_kill_decisions')).toBe(true);
    expect(await tableExists('votes')).toBe(true);
    expect(await tableExists('victory_records')).toBe(true);
  });
});

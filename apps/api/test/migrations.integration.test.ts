import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateUp, rollbackLast } from '../src/db/migrations.js';

/**
 * Runs against a throwaway database created on the server named by
 * DATABASE_URL (default: the Compose service from `pnpm db:up`).
 */
const adminUrl = new URL(process.env.DATABASE_URL ?? 'postgres://warewolf:warewolf@localhost:5433/warewolf');
const dbName = `warewolf_test_${randomBytes(4).toString('hex')}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${dbName}`;

let admin: Pool;
let pool: Pool;

const HOST = '00000000-0000-4000-8000-000000000001';

async function tableExists(name: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(`select to_regclass($1) is not null as exists`, [`public.${name}`]);
  return res.rows[0]?.exists ?? false;
}

async function insertGame(roomCode: string, status = 'LOBBY') {
  return pool.query(`insert into games (room_code, status, host_player_id, mode) values ($1, $2, $3, 'INFECTION')`, [
    roomCode,
    status,
    HOST,
  ]);
}

beforeAll(async () => {
  admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  await admin.query(`create database ${dbName}`);
  pool = new Pool({ connectionString: testUrl.toString(), max: 2 });
});

afterAll(async () => {
  await pool?.end();
  await admin?.query(`drop database if exists ${dbName} with (force)`);
  await admin?.end();
});

describe('games migration', () => {
  it('creates games with lobby defaults', async () => {
    await migrateUp(pool);
    expect(await tableExists('games')).toBe(true);

    const res = await pool.query(
      `insert into games (room_code, host_player_id, mode) values ('ABCDEF', $1, 'INFECTION')
       returning status, phase, round_number, state_version, config_draft, config_snapshot, phase_ends_at`,
      [HOST],
    );
    expect(res.rows[0]).toEqual({
      status: 'LOBBY',
      phase: 'LOBBY',
      round_number: 0,
      state_version: 0,
      config_draft: {},
      config_snapshot: null,
      phase_ends_at: null,
    });
  });

  it('is idempotent when re-applied', async () => {
    await expect(migrateUp(pool)).resolves.toBeUndefined();
  });

  it('keeps room codes unique only among open games', async () => {
    await expect(insertGame('ABCDEF')).rejects.toMatchObject({ code: '23505' });
    await expect(insertGame('ABCDEF', 'ACTIVE')).rejects.toMatchObject({ code: '23505' });
    await expect(insertGame('ABCDEF', 'FINISHED')).resolves.toBeDefined();
    await expect(insertGame('ABCDEF', 'CANCELLED')).resolves.toBeDefined();
  });

  it('rejects values outside the domain enumerations', async () => {
    await expect(insertGame('ZZZZZZ', 'PAUSED')).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(`insert into games (room_code, host_player_id, mode) values ('YYYYYY', $1, 'BATTLE_ROYALE')`, [HOST]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(`insert into games (room_code, host_player_id, mode, phase) values ('XXXXXX', $1, 'CLASSIC', 'DUSK')`, [HOST]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(insertGame('SHORT')).rejects.toMatchObject({ code: '23514' });
  });

  it('has the recovery-scan index', async () => {
    const res = await pool.query<{ indexname: string }>(`select indexname from pg_indexes where tablename = 'games'`);
    expect(res.rows.map((r) => r.indexname).sort()).toEqual(['games_pkey', 'games_room_code_open_uq', 'games_status_phase_idx']);
  });

  it('rolls back, then rolls forward again', async () => {
    expect(await rollbackLast(pool)).toBe('0000_games');
    expect(await tableExists('games')).toBe(false);
    expect(await rollbackLast(pool)).toBeNull();

    await migrateUp(pool);
    expect(await tableExists('games')).toBe(true);
  });
});

import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { migrateUp } from '../../src/db/migrations.js';

/**
 * A throwaway database on the server named by DATABASE_URL (default: the
 * Compose service from `pnpm db:up`). Each test file gets its own.
 */
export interface TestDatabase {
  readonly url: string;
  readonly pool: Pool;
  drop(): Promise<void>;
}

export async function createTestDatabase(options: { migrate?: boolean } = {}): Promise<TestDatabase> {
  const adminUrl = new URL(process.env.DATABASE_URL ?? 'postgres://warewolf:warewolf@localhost:5433/warewolf');
  const name = `warewolf_test_${randomBytes(4).toString('hex')}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  await admin.query(`create database ${name}`);
  const pool = new Pool({ connectionString: url.toString(), max: 4 });
  // `drop database ... with (force)` terminates connections that are still closing.
  pool.on('error', () => {});
  if (options.migrate ?? true) await migrateUp(pool);

  return {
    url: url.toString(),
    pool,
    async drop() {
      await pool.end();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}

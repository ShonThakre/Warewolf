import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';
import { z } from 'zod';

/** apps/api/drizzle, from both src/db (tests) and dist/db (runtime). */
export const MIGRATIONS_DIR = new URL('../../drizzle/', import.meta.url);

const journalSchema = z.object({
  entries: z.array(z.object({ idx: z.number(), when: z.number(), tag: z.string() })),
});

async function readJournal() {
  const raw = await readFile(new URL('meta/_journal.json', MIGRATIONS_DIR), 'utf8');
  return journalSchema.parse(JSON.parse(raw)).entries;
}

/** Applies every pending migration in order. */
export async function migrateUp(pool: Pool): Promise<void> {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR.pathname });
}

/**
 * Reverts the most recently applied migration by running
 * `drizzle/down/<tag>.sql` and removing its row from Drizzle's ledger.
 * Drizzle has no down migrations, so each up file needs a matching down file.
 * Returns the reverted tag, or null when nothing is applied.
 */
export async function rollbackLast(pool: Pool): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const ledger = await client.query<{ id: number; created_at: string }>(
      `select id, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1 for update`,
    );
    const last = ledger.rows[0];
    if (!last) {
      await client.query('rollback');
      return null;
    }

    const entry = (await readJournal()).find((e) => String(e.when) === String(last.created_at));
    if (!entry) throw new Error(`No journal entry for applied migration created_at=${last.created_at}`);

    const downSql = await readFile(new URL(`down/${entry.tag}.sql`, MIGRATIONS_DIR), 'utf8');
    await client.query(downSql);
    await client.query('delete from drizzle.__drizzle_migrations where id = $1', [last.id]);
    await client.query('commit');
    return entry.tag;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

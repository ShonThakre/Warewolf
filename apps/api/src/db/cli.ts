import { Pool } from 'pg';
import { loadConfig } from '../config.js';
import { migrateUp, rollbackLast } from './migrations.js';

const command = process.argv[2];
const { databaseUrl } = loadConfig();
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env or export it.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  if (command === 'up') {
    await migrateUp(pool);
    console.log('Migrations applied.');
  } else if (command === 'down') {
    const tag = await rollbackLast(pool);
    console.log(tag ? `Rolled back ${tag}.` : 'Nothing to roll back.');
  } else {
    console.error('Usage: cli.js <up|down>');
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}

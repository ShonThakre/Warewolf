import type { INestApplication } from '@nestjs/common';
import { seatCredentialsSchema } from '@warewolf/contracts';
import { getPack } from '@warewolf/domain';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1403. Each preset deals exactly the counts in its role list.
 */

let db: TestDatabase;
let app: INestApplication;

const api = () => request(app.getHttpServer());
const PACKS = ['classic-10', 'chaos-15', 'infection-core', 'expanded-24', 'expanded-30'] as const;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

describe('preset deal counts (WW-1403)', () => {
  it.each(PACKS)('deals %s with the preset counts', async (packId) => {
    const pack = getPack(packId)!;
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: pack.config.mode }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const auth = { Authorization: `Bearer ${host.token}` };
    if (packId !== 'infection-core') {
      await api().put(`/api/v1/games/${host.gameId}/configuration`).set(auth).send(pack.config).expect(200);
    }
    for (let i = 2; i <= pack.config.playerCount; i++) {
      await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    }
    await api().post(`/api/v1/games/${host.gameId}/start`).set(auth).send({ acknowledgeWarnings: true }).expect(200);

    const { rows } = await db.pool.query<{ original_role_id: string; n: number }>(
      `select original_role_id, count(*)::int as n from role_assignments where game_id = $1 group by original_role_id`,
      [host.gameId],
    );
    const counts = Object.fromEntries(rows.map((row) => [row.original_role_id, row.n]));
    const expected = Object.fromEntries(pack.config.roles.filter((role) => role.count > 0).map((role) => [role.roleId, role.count]));
    expect(counts).toEqual(expected);
    expect(rows.reduce((sum, row) => sum + row.n, 0)).toBe(pack.config.playerCount);
  });
});

import type { INestApplication } from '@nestjs/common';
import { readinessResponseSchema } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/** WW-1503: readiness against a real PostgreSQL. The 503 path is in request-log.test.ts. */

let db: TestDatabase;
let app: INestApplication;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

describe('GET /health/ready', () => {
  it('is 200 with the database reachable, and carries a request id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(readinessResponseSchema.parse(res.body)).toEqual({ status: 'ok', database: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

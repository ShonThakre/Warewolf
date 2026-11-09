import type { INestApplication } from '@nestjs/common';
import { errorBodySchema, healthResponseSchema, versionResponseSchema } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('system routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp(loadConfig({ GIT_SHA: 'abc1234' }), { logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 without a database', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/version reports the package and commit', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/version').expect(200);
    expect(versionResponseSchema.parse(res.body)).toEqual({ name: '@warewolf/api', version: '0.0.0', commit: 'abc1234' });
  });

  it('unknown routes use the shared error body with a generic message', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/games/secret-wolf-id').expect(404);
    expect(errorBodySchema.parse(res.body)).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    expect(JSON.stringify(res.body)).not.toContain('secret-wolf-id');
  });

  it('routes live under the versioned base path only', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});

describe('loadConfig', () => {
  it('defaults the port and leaves the database optional', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3000);
    expect(config.databaseUrl).toBeNull();
    expect(config.commit).toBeNull();
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow();
  });
});

import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Database } from '../src/db/database.js';
import { ReadinessController } from '../src/system/readiness.controller.js';

/** WW-1503: every request has an id, and its log line holds ids only. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let app: INestApplication;
let lines: string[];

beforeEach(async () => {
  lines = [];
  vi.spyOn(Logger.prototype, 'log').mockImplementation(function (this: Logger, message: unknown) {
    if (typeof message === 'string' && message.startsWith('request ')) lines.push(message);
  });
  app = await createApp(loadConfig({}), { logger: false });
  await app.init();
});

afterEach(async () => {
  await app.close();
  vi.restoreAllMocks();
});

const api = () => request(app.getHttpServer());

describe('request ids', () => {
  it('generates an id, returns it, and logs one line with it', async () => {
    const res = await api().get('/api/v1/health?token=ww_secret_should_not_appear').expect(200);
    const id = res.headers['x-request-id'] as string;
    expect(id).toMatch(UUID);
    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(lines[0]).toMatch(new RegExp(`^request request=${id} method=GET path=/api/v1/health status=200 ms=\\d+$`));
    expect(lines[0]).not.toContain('ww_secret');
  });

  it('keeps a well-formed incoming id and replaces anything else', async () => {
    const kept = await api().get('/api/v1/health').set('X-Request-Id', 'proxy-abc_123.45').expect(200);
    expect(kept.headers['x-request-id']).toBe('proxy-abc_123.45');
    const replaced = await api().get('/api/v1/health').set('X-Request-Id', 'bad id with spaces <script>').expect(200);
    expect(replaced.headers['x-request-id']).toMatch(UUID);
    const tooLong = await api().get('/api/v1/health').set('X-Request-Id', 'x'.repeat(65)).expect(200);
    expect(tooLong.headers['x-request-id']).toMatch(UUID);
  });

  it('names the game when the path does, including on an error', async () => {
    const game = '6A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D';
    const res = await api().get(`/api/v1/games/${game}/state`).expect(404);
    await vi.waitFor(() => expect(lines).toHaveLength(1));
    expect(lines[0]).toContain(`request=${res.headers['x-request-id']}`);
    expect(lines[0]).toContain('status=404');
    expect(lines[0]).toContain(`game=${game.toLowerCase()}`);
  });
});

describe('GET /health/ready', () => {
  const respond = () => {
    const res = { statusCode: 200, status(code: number) { this.statusCode = code; return this; } };
    return res;
  };

  it('is 200 when the database answers', async () => {
    const controller = new ReadinessController({ execute: async () => ({ rows: [] }) } as unknown as Database);
    const res = respond();
    expect(await controller.ready(res as never)).toEqual({ status: 'ok', database: 'ok' });
    expect(res.statusCode).toBe(200);
  });

  it('is 503 when the database fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const controller = new ReadinessController({ execute: async () => Promise.reject(new Error('ECONNREFUSED')) } as unknown as Database);
    const res = respond();
    expect(await controller.ready(res as never)).toEqual({ status: 'unavailable', database: 'unavailable' });
    expect(res.statusCode).toBe(503);
  });
});

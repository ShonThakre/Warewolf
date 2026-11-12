import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * HOST-01: with WEB_DIST_DIR set, the API serves the built client next to
 * `/api` on one origin. Without it, the API serves nothing else.
 */

let dist: string;
let app: INestApplication | undefined;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), 'warewolf-web-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Warewolf</title>');
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(join(dist, 'favicon.svg'), '<svg/>');
});

afterAll(() => rmSync(dist, { recursive: true, force: true }));

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(env: Record<string, string>) {
  app = await createApp(loadConfig(env), { logger: false });
  await app.init();
  return request(app.getHttpServer());
}

describe('WEB_DIST_DIR', () => {
  it('serves index.html at the root and on client routes, uncached', async () => {
    const api = await start({ WEB_DIST_DIR: dist });
    for (const path of ['/', '/game/ABCD', '/lobby/XYZ/setup']) {
      const res = await api.get(path).expect(200);
      expect(res.text).toContain('<title>Warewolf</title>');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('serves fingerprinted assets with a long immutable cache, and other files plainly', async () => {
    const api = await start({ WEB_DIST_DIR: dist });
    const asset = await api.get('/assets/index-abc123.js').expect(200);
    expect(asset.headers['cache-control']).toMatch(/max-age=31536000.*immutable/);
    await api.get('/favicon.svg').expect(200);
  });

  it('leaves the API to the API, and a missing file is a 404, never index.html', async () => {
    const api = await start({ WEB_DIST_DIR: dist });
    const health = await api.get('/api/v1/health').expect(200);
    expect(health.headers['content-type']).toMatch(/json/);
    const unknown = await api.get('/api/v1/no-such-route').expect(404);
    expect(unknown.body).toHaveProperty('error');
    for (const path of ['/assets/missing.js', '/missing.png']) {
      const res = await api.get(path).expect(404);
      expect(res.text).not.toContain('<title>Warewolf</title>');
    }
    await api.post('/game/ABCD').expect(404);
  });

  it('serves no client when unset, and refuses a directory without index.html', async () => {
    expect(loadConfig({}).webDistDir).toBeNull();
    const api = await start({});
    await api.get('/').expect(404);
    await app?.close();
    app = undefined;
    await expect(createApp(loadConfig({ WEB_DIST_DIR: join(dist, 'assets') }), { logger: false })).rejects.toThrow(/index\.html/);
  });
});

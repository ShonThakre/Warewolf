import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * WW-1602: the APK's WebView calls the API from another origin. Only origins
 * listed in CORS_ORIGINS may; with none listed the API stays same-origin, as
 * the web deployment needs.
 */

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(env: Record<string, string>) {
  app = await createApp(loadConfig(env), { logger: false });
  await app.init();
  return request(app.getHttpServer());
}

describe('CORS_ORIGINS', () => {
  it('parses a comma list of exact origins and refuses anything else', () => {
    expect(loadConfig({}).corsOrigins).toEqual([]);
    expect(loadConfig({ CORS_ORIGINS: ' https://localhost , http://localhost ' }).corsOrigins).toEqual(['https://localhost', 'http://localhost']);
    expect(() => loadConfig({ CORS_ORIGINS: 'https://localhost/' })).toThrow();
    expect(() => loadConfig({ CORS_ORIGINS: 'localhost' })).toThrow();
    expect(() => loadConfig({ CORS_ORIGINS: 'capacitor://localhost' })).toThrow();
    expect(() => loadConfig({ CORS_ORIGINS: '*' })).toThrow();
  });

  it('answers a listed origin, with the headers the client sends', async () => {
    const api = await start({ CORS_ORIGINS: 'https://localhost' });
    const preflight = await api
      .options('/api/v1/health')
      .set('Origin', 'https://localhost')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('https://localhost');
    expect(preflight.headers['access-control-allow-headers']).toMatch(/Idempotency-Key/);

    const get = await api.get('/api/v1/health').set('Origin', 'https://localhost').expect(200);
    expect(get.headers['access-control-allow-origin']).toBe('https://localhost');

    const other = await api.get('/api/v1/health').set('Origin', 'https://evil.example').expect(200);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows no other origin by default', async () => {
    const api = await start({});
    const get = await api.get('/api/v1/health').set('Origin', 'https://localhost').expect(200);
    expect(get.headers['access-control-allow-origin']).toBeUndefined();
  });
});

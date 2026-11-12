import 'reflect-metadata';
import type { INestApplication, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_BASE_PATH } from '@warewolf/contracts';
import { AppModule, type AppOverrides } from './app.module.js';
import type { AppConfig } from './config.js';
import { ErrorFilter } from './http/error.filter.js';
import { requestLog } from './http/request-log.js';
import { serveWebClient } from './http/web-client.js';

/** Builds a configured app without listening. Shared by main and tests. */
export async function createApp(
  config: AppConfig,
  options: { logger?: LogLevel[] | false; overrides?: AppOverrides } = {},
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config, options.overrides), {
    logger: options.logger ?? ['error', 'warn', 'log'],
  });
  // Before every route, so each request carries an id from the start (WW-1503).
  app.use(requestLog());
  if (config.webDistDir) serveWebClient(app, config.webDistDir);
  app.setGlobalPrefix(API_BASE_PATH.replace(/^\//, ''));
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  // The APK's WebView is another origin (WW-1602). The web build is served same-origin and needs nothing here.
  if (config.corsOrigins.length > 0) {
    app.enableCors({
      origin: [...config.corsOrigins],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    });
  }
  return app;
}

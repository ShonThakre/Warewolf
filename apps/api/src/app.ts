import 'reflect-metadata';
import type { INestApplication, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_BASE_PATH } from '@warewolf/contracts';
import { AppModule, type AppOverrides } from './app.module.js';
import type { AppConfig } from './config.js';
import { ErrorFilter } from './http/error.filter.js';

/** Builds a configured app without listening. Shared by main and tests. */
export async function createApp(
  config: AppConfig,
  options: { logger?: LogLevel[] | false; overrides?: AppOverrides } = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(config, options.overrides), {
    logger: options.logger ?? ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix(API_BASE_PATH.replace(/^\//, ''));
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  return app;
}

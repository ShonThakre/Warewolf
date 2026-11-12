import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { logLine } from './log-line.js';

/**
 * Request ids and one log line per request (WW-1503). The id comes from a
 * well-formed `X-Request-Id` header, so a proxy's id carries through, or is
 * generated. It is returned on the response and written on every line about
 * the request.
 *
 * The line holds ids only (WW-1304): method, path without its query string,
 * status, duration, and the game id when the path names one. Tokens travel in
 * the Authorization header and never reach the path; display names and room
 * codes travel in bodies, which are never logged.
 */

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;
const GAME_IN_PATH = /\/games\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export type RequestWithId = Request & { requestId?: string };

export function requestIdOf(req: Request): string | undefined {
  return (req as RequestWithId).requestId;
}

export function requestLog(logger = new Logger('Request')) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
    (req as RequestWithId).requestId = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const path = (req.originalUrl || req.url).split('?')[0] ?? '';
      const game = GAME_IN_PATH.exec(path)?.[1]?.toLowerCase();
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      logger.log(logLine('request', { request: id, method: req.method, path, status: res.statusCode, ms, ...(game ? { game } : {}) }));
    });
    next();
  };
}

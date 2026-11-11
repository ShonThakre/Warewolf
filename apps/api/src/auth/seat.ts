import { createHash, randomBytes } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DATABASE, type Database } from '../db/database.js';
import { gamePlayers, type GamePlayerRow } from '../db/schema.js';
import { errors } from '../http/api-error.js';

/**
 * Guest seat tokens (OD-63). A token is 32 random bytes, returned once at
 * create or join. Only its SHA-256 is stored, so a database leak does not
 * hand out seats.
 */
export function newSeatToken(): string {
  return `ww_${randomBytes(32).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SeatRequest = Request & { seat?: GamePlayerRow };

/**
 * Resolves `Authorization: Bearer <token>` to the caller's seat in the
 * `:gameId` route game.
 *
 * - No token, or a token that matches no seat: 401.
 * - A token for a seat in another game: 404, so the caller learns nothing about this game id.
 */
@Injectable()
export class SeatGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SeatRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw errors.unauthenticated();
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw errors.unauthenticated();

    const [seat] = await this.db.select().from(gamePlayers).where(eq(gamePlayers.tokenHash, hashToken(token))).limit(1);
    if (!seat) throw errors.unauthenticated();

    const gameId = request.params['gameId'];
    if (typeof gameId !== 'string' || !UUID.test(gameId) || seat.gameId !== gameId.toLowerCase()) throw errors.notFound();

    request.seat = seat;
    return true;
  }
}

/** The authenticated caller's seat, set by `SeatGuard`. */
export const CurrentSeat = createParamDecorator((_data: unknown, context: ExecutionContext): GamePlayerRow => {
  const seat = context.switchToHttp().getRequest<SeatRequest>().seat;
  if (!seat) throw errors.unauthenticated();
  return seat;
});

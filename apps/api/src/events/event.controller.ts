import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import type { GameEventsResponse } from '@warewolf/contracts';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { errors, UuidParam } from '../http/api-error.js';
import { EventService } from './event.service.js';

/** Reconnect catch-up. The socket replays the same rows on `join-session`. */
@Controller('games/:gameId')
@UseGuards(SeatGuard)
export class EventController {
  constructor(@Inject(EventService) private readonly events: EventService) {}

  @Get('events')
  list(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Query('afterSeq') afterSeq?: string,
  ): Promise<GameEventsResponse> {
    return this.events.since(gameId, seat, parseAfterSeq(afterSeq));
  }
}

/** Missing means the beginning. Anything else must be a whole number. */
export function parseAfterSeq(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  if (!/^\d+$/.test(value)) throw errors.invalid([{ path: 'afterSeq', message: 'afterSeq is a whole number.' }]);
  return Number(value);
}

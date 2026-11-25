import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import type { GameLog } from '@warewolf/contracts';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam } from '../http/api-error.js';
import { LogService } from './log.service.js';

/** LOG-01: the game log. Redacted for the caller; see `LogService`. */
@Controller('games/:gameId')
@UseGuards(SeatGuard)
export class LogController {
  constructor(@Inject(LogService) private readonly logs: LogService) {}

  @Get('log')
  get(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<GameLog> {
    return this.logs.forSeat(gameId, seat);
  }

  /** Host only (403 otherwise): every secret, live. */
  @Get('host/log')
  host(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<GameLog> {
    return this.logs.forHost(gameId, seat);
  }
}

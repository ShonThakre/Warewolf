import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import type { GameResults } from '@warewolf/contracts';
import { SeatGuard } from '../auth/seat.js';
import { UuidParam } from '../http/api-error.js';
import { ResultsService } from './results.service.js';

/** The recap. See docs/werewolf/api-design.md, section 5. Any seat in the game; the token guard keeps other games out. */
@Controller('games/:gameId/results')
@UseGuards(SeatGuard)
export class ResultsController {
  constructor(@Inject(ResultsService) private readonly results: ResultsService) {}

  @Get()
  get(@Param('gameId', new UuidParam()) gameId: string): Promise<GameResults> {
    return this.results.results(gameId);
  }
}

import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { castVoteRequestSchema, type CastVoteResponse } from '@warewolf/contracts';
import type { z } from 'zod';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam, ZodBody } from '../http/api-error.js';
import { VoteService } from './vote.service.js';

/** Ballots. See docs/werewolf/api-design.md, section 7. */
@Controller('games/:gameId')
@UseGuards(SeatGuard)
export class VoteController {
  constructor(@Inject(VoteService) private readonly votes: VoteService) {}

  @Post('votes')
  @HttpCode(200)
  cast(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(castVoteRequestSchema)) body: z.infer<typeof castVoteRequestSchema>,
  ): Promise<CastVoteResponse> {
    return this.votes.cast(gameId, seat, body);
  }
}

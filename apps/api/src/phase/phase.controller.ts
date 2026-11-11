import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { closePhaseRequestSchema, type GameState } from '@warewolf/contracts';
import type { z } from 'zod';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam, ZodBody } from '../http/api-error.js';
import { PhaseService } from './phase.service.js';

/** Game state and the host's phase close. See docs/werewolf/api-design.md, sections 5 and 8. */
@Controller('games/:gameId')
@UseGuards(SeatGuard)
export class PhaseController {
  constructor(@Inject(PhaseService) private readonly phases: PhaseService) {}

  @Get('state')
  state(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<GameState> {
    return this.phases.state(gameId, seat);
  }

  @Post('host/phase/close')
  @HttpCode(200)
  close(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(closePhaseRequestSchema)) body: z.infer<typeof closePhaseRequestSchema>,
  ): Promise<GameState> {
    return this.phases.close(gameId, seat, body.stateVersion);
  }
}

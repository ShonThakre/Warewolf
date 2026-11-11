import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { startGameRequestSchema, type HostRoster, type MyRole, type StartGameResponse } from '@warewolf/contracts';
import type { z } from 'zod';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam, ZodBody } from '../http/api-error.js';
import { RoleViewService } from './role-view.service.js';
import { StartService } from './start.service.js';

/** Start and the role projections. See docs/werewolf/api-design.md, sections 1 and 4. */
@Controller('games/:gameId')
@UseGuards(SeatGuard)
export class AssignmentController {
  constructor(
    @Inject(StartService) private readonly starter: StartService,
    @Inject(RoleViewService) private readonly views: RoleViewService,
  ) {}

  @Post('start')
  @HttpCode(200)
  start(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(startGameRequestSchema)) body: z.infer<typeof startGameRequestSchema>,
  ): Promise<StartGameResponse> {
    return this.starter.start(gameId, seat, body.acknowledgeWarnings);
  }

  @Get('me')
  me(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<MyRole> {
    return this.views.me(gameId, seat);
  }

  @Get('host/roster')
  roster(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<HostRoster> {
    return this.views.roster(gameId, seat);
  }
}

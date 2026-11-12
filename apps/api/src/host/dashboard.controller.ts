import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import type { HostDashboard } from '@warewolf/contracts';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam } from '../http/api-error.js';
import { DashboardService } from './dashboard.service.js';

/** The host dashboard. See docs/werewolf/api-design.md, section 8. */
@Controller('games/:gameId/host/dashboard')
@UseGuards(SeatGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboards: DashboardService) {}

  @Get()
  get(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<HostDashboard> {
    return this.dashboards.dashboard(gameId, seat);
  }
}

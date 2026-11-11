import { type DynamicModule, Module } from '@nestjs/common';
import type { RandomInt } from '@warewolf/domain';
import { ActionController } from './action/action.controller.js';
import { ActionService } from './action/action.service.js';
import { AssignmentController } from './assignment/assignment.controller.js';
import { RoleViewService } from './assignment/role-view.service.js';
import { DEAL_RANDOM, StartService, cryptoRandomInt } from './assignment/start.service.js';
import { SeatGuard } from './auth/seat.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { APP_CONFIG, type AppConfig } from './config.js';
import { ConfigurationController, ConfigurationService } from './configuration/configuration.js';
import { DatabaseModule } from './db/database.js';
import { DayResolutionService } from './day/day-resolution.service.js';
import { EventService } from './events/event.service.js';
import { VoteController } from './day/vote.controller.js';
import { VoteService } from './day/vote.service.js';
import { LobbyController } from './lobby/lobby.controller.js';
import { LobbyService } from './lobby/lobby.service.js';
import { KillTargetController, KillTargetService } from './night/kill-target.js';
import { NightResolutionService } from './night/night-resolution.service.js';
import { PhaseController } from './phase/phase.controller.js';
import { PhaseService } from './phase/phase.service.js';
import { PHASE_RESOLVERS, phaseResolvers, type PhaseResolvers } from './phase/resolution.js';
import { PHASE_CLOCK, PHASE_SCHEDULER, TimeoutScheduler, systemClock, type Clock, type PhaseScheduler } from './phase/timing.js';
import { PlayGateway } from './realtime/play.gateway.js';
import { SystemController } from './system/system.controller.js';

/**
 * Test seams. `main.ts` never passes them, so production always deals with
 * the CSPRNG, reads the system clock, schedules real timers, and runs the
 * real resolvers.
 */
export interface AppOverrides {
  readonly dealRandom?: RandomInt;
  readonly clock?: Clock;
  readonly scheduler?: PhaseScheduler;
  readonly resolvers?: PhaseResolvers;
}

@Module({})
export class AppModule {
  /**
   * Routes that need PostgreSQL are registered only when DATABASE_URL is set.
   * `main.ts` refuses to start without it; unit tests of the system and catalog
   * routes run without a database.
   */
  static register(config: AppConfig, overrides: AppOverrides = {}): DynamicModule {
    const base = {
      module: AppModule,
      controllers: [SystemController, CatalogController],
      providers: [{ provide: APP_CONFIG, useValue: config }],
    };
    if (!config.databaseUrl) return base;
    return {
      ...base,
      imports: [DatabaseModule.forUrl(config.databaseUrl)],
      controllers: [...base.controllers, LobbyController, ConfigurationController, AssignmentController, PhaseController, ActionController, KillTargetController, VoteController],
      providers: [
        ...base.providers,
        SeatGuard,
        LobbyService,
        ConfigurationService,
        StartService,
        RoleViewService,
        { provide: DEAL_RANDOM, useValue: overrides.dealRandom ?? cryptoRandomInt },
        PhaseService,
        ActionService,
        { provide: PHASE_CLOCK, useValue: overrides.clock ?? systemClock },
        overrides.scheduler ? { provide: PHASE_SCHEDULER, useValue: overrides.scheduler } : { provide: PHASE_SCHEDULER, useClass: TimeoutScheduler },
        NightResolutionService,
        DayResolutionService,
        EventService,
        PlayGateway,
        VoteService,
        KillTargetService,
        {
          provide: PHASE_RESOLVERS,
          inject: [NightResolutionService, DayResolutionService],
          useFactory: (night: NightResolutionService, day: DayResolutionService) => overrides.resolvers ?? phaseResolvers(night, day),
        },
      ],
    };
  }
}

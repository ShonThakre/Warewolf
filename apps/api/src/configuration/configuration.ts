import { Body, Controller, Get, HttpCode, Inject, Injectable, Param, Post, Put, UseGuards } from '@nestjs/common';
import { gameConfigurationSchema, parseGameConfiguration, type ConfigurationResponse } from '@warewolf/contracts';
import { validateConfiguration, type GameConfiguration } from '@warewolf/domain';
import { eq } from 'drizzle-orm';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import { DATABASE, type Database } from '../db/database.js';
import { games, type GamePlayerRow } from '../db/schema.js';
import { UuidParam, ZodBody, errors } from '../http/api-error.js';
import { LobbyService } from '../lobby/lobby.service.js';

/**
 * Configuration drafts (WW-303). Saving an invalid draft is allowed so the
 * host can edit in steps; the lobby projection keeps start closed until the
 * draft validates. The start route (WW-402) validates again in its own transaction.
 */
@Injectable()
export class ConfigurationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LobbyService) private readonly lobby: LobbyService,
  ) {}

  async get(gameId: string, seat: GamePlayerRow): Promise<ConfigurationResponse> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    if (game.status !== 'LOBBY') throw errors.gameStarted();
    return this.respond(this.lobby.draft(game), seat.isHost);
  }

  async save(gameId: string, seat: GamePlayerRow, draft: GameConfiguration): Promise<ConfigurationResponse> {
    await this.db.transaction(async (tx) => {
      const { game, you } = await this.lobby.lock(tx, gameId, seat.id);
      if (!you.isHost) throw errors.notHost();
      if (game.status !== 'LOBBY') throw errors.gameStarted();
      await tx.update(games).set({ configDraft: draft, mode: draft.mode }).where(eq(games.id, game.id));
      await this.lobby.bump(tx, game.id);
    });
    return this.respond(draft, true);
  }

  async check(gameId: string, seat: GamePlayerRow, draft: GameConfiguration): Promise<ConfigurationResponse> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw errors.notFound();
    if (!seat.isHost) throw errors.notHost();
    if (game.status !== 'LOBBY') throw errors.gameStarted();
    return this.respond(draft, true);
  }

  private respond(draft: GameConfiguration, isHost: boolean): ConfigurationResponse {
    const validation = validateConfiguration(draft);
    return {
      draft: draft as ConfigurationResponse['draft'],
      validation: {
        valid: validation.valid,
        errors: [...validation.errors],
        warnings: [...validation.warnings],
        infos: [...validation.infos],
        summary: validation.summary,
      } as ConfigurationResponse['validation'],
      editable: isHost,
    };
  }
}

const draftBody = new ZodBody(gameConfigurationSchema.transform((d) => parseGameConfiguration(d)));

@Controller('games/:gameId/configuration')
@UseGuards(SeatGuard)
export class ConfigurationController {
  constructor(@Inject(ConfigurationService) private readonly configuration: ConfigurationService) {}

  @Get()
  get(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<ConfigurationResponse> {
    return this.configuration.get(gameId, seat);
  }

  @Put()
  save(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow, @Body(draftBody) draft: GameConfiguration) {
    return this.configuration.save(gameId, seat, draft);
  }

  @Post('validate')
  @HttpCode(200)
  check(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow, @Body(draftBody) draft: GameConfiguration) {
    return this.configuration.check(gameId, seat, draft);
  }
}

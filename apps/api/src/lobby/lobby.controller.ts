import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  changeAvatarRequestSchema,
  createGameRequestSchema,
  joinGameRequestSchema,
  leaveGameRequestSchema,
  transferHostRequestSchema,
  type LeaveGameResponse,
  type LobbyProjection,
  type SeatCredentials,
} from '@warewolf/contracts';
import type { Request } from 'express';
import type { z } from 'zod';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { errors, UuidParam, ZodBody } from '../http/api-error.js';
import { clientAddress, JoinRateLimiter } from '../http/rate-limit.js';
import { LobbyService } from './lobby.service.js';

@Controller('games')
export class LobbyController {
  private readonly joins = new JoinRateLimiter();

  constructor(@Inject(LobbyService) private readonly lobby: LobbyService) {}

  @Post()
  create(@Body(new ZodBody(createGameRequestSchema)) body: z.infer<typeof createGameRequestSchema>): Promise<SeatCredentials> {
    return this.lobby.create(body.displayName, body.mode, body.avatarId);
  }

  @Post('join')
  join(@Req() req: Request, @Body(new ZodBody(joinGameRequestSchema)) body: z.infer<typeof joinGameRequestSchema>): Promise<SeatCredentials> {
    if (!this.joins.allow(clientAddress(req), body.roomCode)) throw errors.rateLimited();
    return this.lobby.join(body.roomCode, body.displayName, body.avatarId);
  }

  @Get(':gameId')
  @UseGuards(SeatGuard)
  get(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<LobbyProjection> {
    return this.lobby.projection(gameId, seat.id);
  }

  @Post(':gameId/leave')
  @HttpCode(200)
  @UseGuards(SeatGuard)
  leave(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(leaveGameRequestSchema)) body: z.infer<typeof leaveGameRequestSchema>,
  ): Promise<LeaveGameResponse> {
    return this.lobby.leave(gameId, seat, body.hostPlayerId);
  }

  @Put(':gameId/me/avatar')
  @UseGuards(SeatGuard)
  changeAvatar(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(changeAvatarRequestSchema)) body: z.infer<typeof changeAvatarRequestSchema>,
  ): Promise<LobbyProjection> {
    return this.lobby.changeAvatar(gameId, seat, body.avatarId);
  }

  @Post(':gameId/players/:playerId/kick')
  @HttpCode(200)
  @UseGuards(SeatGuard)
  kick(@Param('gameId', new UuidParam()) gameId: string, @Param('playerId', new UuidParam()) playerId: string, @CurrentSeat() seat: GamePlayerRow): Promise<LobbyProjection> {
    return this.lobby.kick(gameId, seat, playerId);
  }

  @Post(':gameId/host/transfer')
  @HttpCode(200)
  @UseGuards(SeatGuard)
  transfer(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(transferHostRequestSchema)) body: z.infer<typeof transferHostRequestSchema>,
  ): Promise<LobbyProjection> {
    return this.lobby.transfer(gameId, seat, body.playerId);
  }

  @Post(':gameId/host/cancel')
  @HttpCode(200)
  @UseGuards(SeatGuard)
  cancel(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<LobbyProjection> {
    return this.lobby.cancel(gameId, seat);
  }
}

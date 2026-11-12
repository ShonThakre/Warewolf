import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { postChatMessageRequestSchema, type ChatMessage, type ChatView } from '@warewolf/contracts';
import type { z } from 'zod';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam, ZodBody } from '../http/api-error.js';
import { ChatService } from './chat.service.js';

/** Table chat and its moderation. See docs/werewolf/api-design.md, section 13. */
@Controller('games/:gameId/chat')
@UseGuards(SeatGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get()
  view(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<ChatView> {
    return this.chat.view(gameId, seat);
  }

  @Post('messages')
  @HttpCode(201)
  post(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Body(new ZodBody(postChatMessageRequestSchema)) body: z.output<typeof postChatMessageRequestSchema>,
  ): Promise<ChatMessage> {
    return this.chat.post(gameId, seat, body.body);
  }

  @Delete('messages/:messageId')
  @HttpCode(204)
  async remove(
    @Param('gameId', new UuidParam()) gameId: string,
    @Param('messageId', new UuidParam()) messageId: string,
    @CurrentSeat() seat: GamePlayerRow,
  ): Promise<void> {
    await this.chat.remove(gameId, seat, messageId);
  }

  @Put('mutes/:playerId')
  @HttpCode(204)
  async mute(
    @Param('gameId', new UuidParam()) gameId: string,
    @Param('playerId', new UuidParam()) playerId: string,
    @CurrentSeat() seat: GamePlayerRow,
  ): Promise<void> {
    await this.chat.setMuted(gameId, seat, playerId, true);
  }

  @Delete('mutes/:playerId')
  @HttpCode(204)
  async unmute(
    @Param('gameId', new UuidParam()) gameId: string,
    @Param('playerId', new UuidParam()) playerId: string,
    @CurrentSeat() seat: GamePlayerRow,
  ): Promise<void> {
    await this.chat.setMuted(gameId, seat, playerId, false);
  }
}

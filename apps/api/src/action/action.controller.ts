import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { IDEMPOTENCY_KEY_HEADER, idempotencyKeySchema, submitActionRequestSchema, type MyActions, type SubmitActionResponse } from '@warewolf/contracts';
import { CurrentSeat, SeatGuard } from '../auth/seat.js';
import type { GamePlayerRow } from '../db/schema.js';
import { UuidParam, ZodBody, errors } from '../http/api-error.js';
import { ActionService, type ParsedSubmission } from './action.service.js';

/** Ability actions. See docs/werewolf/api-design.md, section 6. */
@Controller('games/:gameId')
@UseGuards(SeatGuard)
export class ActionController {
  constructor(@Inject(ActionService) private readonly actions: ActionService) {}

  @Post('actions')
  @HttpCode(200)
  submit(
    @Param('gameId', new UuidParam()) gameId: string,
    @CurrentSeat() seat: GamePlayerRow,
    @Headers(IDEMPOTENCY_KEY_HEADER.toLowerCase()) rawKey: string | undefined,
    @Body(new ZodBody(submitActionRequestSchema)) body: ParsedSubmission,
  ): Promise<SubmitActionResponse> {
    const key = idempotencyKeySchema.safeParse(rawKey);
    if (!key.success) throw errors.invalid([{ path: IDEMPOTENCY_KEY_HEADER, message: key.error.issues[0]?.message ?? 'Send an Idempotency-Key header.' }]);
    return this.actions.submit(gameId, seat, key.data, body);
  }

  @Get('me/actions')
  mine(@Param('gameId', new UuidParam()) gameId: string, @CurrentSeat() seat: GamePlayerRow): Promise<MyActions> {
    return this.actions.mine(gameId, seat);
  }
}

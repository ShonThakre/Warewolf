import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ErrorBody, ErrorCode } from '@warewolf/contracts';
import type { Request, Response } from 'express';
import { ApiError } from './api-error.js';
import { requestIdOf } from './request-log.js';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_FAILED',
};

/** Every code needs a message: a missing one would reach the player as "Something went wrong." */
const GENERIC_MESSAGE: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'The request is not valid.',
  UNAUTHENTICATED: 'Sign in to continue.',
  FORBIDDEN: 'That is not available.',
  NOT_FOUND: 'Not found.',
  NOT_HOST: 'Only the host can do that.',
  ROOM_FULL: 'This room is full.',
  GAME_STARTED: 'This game has already started.',
  DISPLAY_NAME_TAKEN: 'That name is already taken in this room.',
  AVATAR_TAKEN: 'That avatar is already taken.',
  PHASE_CONFLICT: 'That is not possible right now.',
  CONFIG_INVALID: 'The game setup is not valid yet.',
  SEAT_COUNT_MISMATCH: 'Every seat must be filled before the game can start.',
  WARNINGS_UNACKNOWLEDGED: 'Review and accept the setup warnings to start.',
  ACTION_WRONG_PHASE: 'That ability cannot be used right now.',
  ACTION_DEAD: 'Eliminated players cannot act.',
  ACTION_NOT_YOUR_ABILITY: 'That ability is not available to you.',
  ACTION_NO_CHARGES: 'That ability has no uses left right now.',
  ACTION_TARGET_ILLEGAL: 'Choose a different target.',
  ACTION_DUPLICATE: 'That action is already locked in.',
  IDEMPOTENCY_CONFLICT: 'That request key was already used for a different request.',
  VOTE_INELIGIBLE: 'That vote is not allowed.',
  CHAT_CLOSED: 'Chat opens in day discussion and voting.',
  CHAT_READ_ONLY: 'The dead read only.',
  CHAT_MUTED: 'The host muted you.',
  KILL_TARGET_REQUIRED: 'Choose a target, or choose no kill, before closing this phase.',
  KILL_TARGET_NOT_SUBMITTED: 'No wolf chose that player tonight.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  INTERNAL: 'Something went wrong.',
};

/**
 * Every error leaves the API in the shared `{ error: { code, message } }`
 * shape with a generic message. Exception text is logged, never returned,
 * so a thrown message cannot leak a secret to a client. Field issues are
 * included only for the caller's own request body.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code: ErrorCode = exception instanceof ApiError ? exception.code : (CODE_BY_STATUS[status] ?? 'INTERNAL');

    if (status >= 500) {
      const request = requestIdOf(host.switchToHttp().getRequest<Request>());
      const detail = exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
      this.logger.error(`request=${request ?? 'none'} ${detail}`);
    }

    const body: ErrorBody = { error: { code, message: GENERIC_MESSAGE[code] ?? 'Something went wrong.' } };
    if (exception instanceof ApiError && exception.issues?.length) body.error.issues = [...exception.issues];
    response.status(status).json(body);
  }
}

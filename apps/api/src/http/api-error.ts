import { HttpException, HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ErrorCode } from '@warewolf/contracts';
import type { z } from 'zod';

export interface FieldIssue {
  readonly path: string;
  readonly message: string;
}

/** An error with a stable contract code. The filter turns it into the shared error body. */
export class ApiError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    readonly issues?: readonly FieldIssue[],
  ) {
    super(code, status);
  }
}

export const errors = {
  unauthenticated: () => new ApiError('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED),
  /** Also used when a token belongs to another game, so the response does not reveal that the game exists. */
  notFound: () => new ApiError('NOT_FOUND', HttpStatus.NOT_FOUND),
  notHost: () => new ApiError('NOT_HOST', HttpStatus.FORBIDDEN),
  roomFull: () => new ApiError('ROOM_FULL', HttpStatus.CONFLICT),
  gameStarted: () => new ApiError('GAME_STARTED', HttpStatus.CONFLICT),
  nameTaken: () => new ApiError('DISPLAY_NAME_TAKEN', HttpStatus.CONFLICT),
  avatarTaken: () => new ApiError('AVATAR_TAKEN', HttpStatus.CONFLICT),
  phaseConflict: () => new ApiError('PHASE_CONFLICT', HttpStatus.CONFLICT),
  /** Start refused: the draft does not validate. GET .../configuration has the details. */
  configInvalid: () => new ApiError('CONFIG_INVALID', HttpStatus.UNPROCESSABLE_ENTITY),
  seatCountMismatch: () => new ApiError('SEAT_COUNT_MISMATCH', HttpStatus.CONFLICT),
  warningsUnacknowledged: () => new ApiError('WARNINGS_UNACKNOWLEDGED', HttpStatus.UNPROCESSABLE_ENTITY),
  invalid: (issues: readonly FieldIssue[]) => new ApiError('VALIDATION_FAILED', HttpStatus.UNPROCESSABLE_ENTITY, issues),
  // Actions (WW-601). Each refusal reads only what the actor already knows; see checkSubmission in the domain.
  actionWrongPhase: () => new ApiError('ACTION_WRONG_PHASE', HttpStatus.CONFLICT),
  actionDead: () => new ApiError('ACTION_DEAD', HttpStatus.CONFLICT),
  actionNotYourAbility: () => new ApiError('ACTION_NOT_YOUR_ABILITY', HttpStatus.CONFLICT),
  actionNoCharges: () => new ApiError('ACTION_NO_CHARGES', HttpStatus.CONFLICT),
  actionDuplicate: () => new ApiError('ACTION_DUPLICATE', HttpStatus.CONFLICT),
  /** Issues name the caller's own request fields, never another player's data. */
  actionTargetIllegal: (issues: readonly FieldIssue[]) => new ApiError('ACTION_TARGET_ILLEGAL', HttpStatus.UNPROCESSABLE_ENTITY, issues),
  idempotencyConflict: () => new ApiError('IDEMPOTENCY_CONFLICT', HttpStatus.CONFLICT),
  // Host kill confirmation (WW-803). Host only, and the host already knows every submission.
  killTargetRequired: () => new ApiError('KILL_TARGET_REQUIRED', HttpStatus.CONFLICT),
  killTargetNotSubmitted: () =>
    new ApiError('KILL_TARGET_NOT_SUBMITTED', HttpStatus.UNPROCESSABLE_ENTITY, [{ path: 'targetPlayerId', message: 'No wolf chose that player tonight.' }]),
  /** A dead voter, a dead target, an abstention the rules forbid, or a revote target outside the tie. */
  voteIneligible: () => new ApiError('VOTE_INELIGIBLE', HttpStatus.CONFLICT),
  rateLimited: () => new ApiError('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS),
};

/** Parses a request body with a contract schema. Failures are 422 with field issues. */
export class ZodBody<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw errors.invalid(
      result.error.issues.map((issue) => ({ path: issue.path.join('.') || '(body)', message: issue.message })),
    );
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route id that is not a UUID cannot name anything, so it is a 404 rather than a database error. */
export class UuidParam implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw errors.notFound();
    return value.toLowerCase();
  }
}

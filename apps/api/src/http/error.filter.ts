import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ErrorBody, ErrorCode } from '@warewolf/contracts';
import type { Response } from 'express';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
};

const GENERIC_MESSAGE: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'The request is not valid.',
  UNAUTHENTICATED: 'Sign in to continue.',
  FORBIDDEN: 'That is not available.',
  NOT_FOUND: 'Not found.',
  INTERNAL: 'Something went wrong.',
};

/**
 * Every error leaves the API in the shared `{ error: { code, message } }`
 * shape with a generic message. Exception text is logged, never returned,
 * so a thrown message cannot leak a secret to a client.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code: ErrorCode = CODE_BY_STATUS[status] ?? 'INTERNAL';

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    const body: ErrorBody = { error: { code, message: GENERIC_MESSAGE[code] ?? 'Something went wrong.' } };
    response.status(status).json(body);
  }
}

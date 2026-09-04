import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

// docs/04 §4.1 — the one place the standard error envelope is produced, so every endpoint
// returns the same shape ({ error: { code, message, details }, requestId }) without each
// controller having to remember to build it.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request.headers['x-request-id'] as string) ?? randomUUID();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawBody = isHttpException ? exception.getResponse() : null;
    const { code, message, details } = this.normalize(rawBody, exception);

    if (status >= 500) {
      // Full stack server-side only — docs/02 §2.7 (no PII/secrets in logs, but stack traces
      // for 5xx are exactly what error monitoring, e.g. Sentry, needs).
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      error: { code, message, details },
      requestId,
    });
  }

  private normalize(
    rawBody: unknown,
    exception: unknown,
  ): { code: string; message: string; details: Record<string, unknown> } {
    if (rawBody && typeof rawBody === 'object') {
      const body = rawBody as Record<string, unknown>;
      return {
        code: (body.code as string) ?? 'UNEXPECTED_ERROR',
        message: (body.message as string) ?? 'An unexpected error occurred',
        details: (body.details as Record<string, unknown>) ?? {},
      };
    }
    return {
      code: 'UNEXPECTED_ERROR',
      message:
        exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred',
      details: {},
    };
  }
}

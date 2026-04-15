import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service.js';

@Catch()
export class ApiErrorLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorLoggingFilter.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : null;

    const message = this.extractMessage(exception, exceptionResponse);

    try {
      const pool = this.databaseService.getPool();
      await pool.query(
        `INSERT INTO api_error_logs (method, path, status_code, message, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          request?.method ?? 'UNKNOWN',
          request?.originalUrl ?? request?.url ?? 'unknown',
          status,
          message,
          JSON.stringify({
            ip: request?.ip ?? null,
            userAgent: request?.headers?.['user-agent'] ?? null,
            query: request?.query ?? null,
          }),
        ],
      );
    } catch (logError) {
      this.logger.error('Failed to persist API error log', logError as any);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.originalUrl ?? request?.url,
      message,
    });
  }

  private extractMessage(exception: unknown, exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in (exceptionResponse as Record<string, unknown>)
    ) {
      const msg = (exceptionResponse as Record<string, unknown>).message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }

    if (exception instanceof Error) return exception.message;

    return 'Internal server error';
  }
}

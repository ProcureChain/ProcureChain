import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      // Nest can hand back either a plain string or a structured validation
      // payload. Normalise both shapes here so the frontend only has to deal
      // with one error contract.
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as { message?: string | string[]; error?: string };
        if (Array.isArray(body.message)) {
          message = 'Validation failed';
          details = body.message;
        } else if (body.message) {
          message = body.message;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    }

    // Keep this response shape stable. The frontend error helpers rely on it
    // for request-id display, inline validation details, and operator support.
    res.status(status).json({
      statusCode: status,
      code: HttpStatus[status] ?? 'ERROR',
      message,
      details,
      requestId: req.requestId ?? null,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}

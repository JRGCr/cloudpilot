/**
 * Error handling middleware and error classes
 */

import type { Next } from 'hono';
import type { AppContext } from '../types/context.js';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, 401, 'UNAUTHORIZED', details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 403, 'FORBIDDEN', details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(message, 429, 'RATE_LIMITED', details);
    this.name = 'RateLimitError';
  }
}

export function errorHandler() {
  return async (c: AppContext, next: Next) => {
    try {
      await next();
    } catch (error) {
      const logger = c.get('logger');
      const requestId = c.get('requestId');
      const isProduction = c.env.NODE_ENV === 'production';

      if (error instanceof AppError) {
        logger?.warn(`AppError: ${error.code}`, {
          statusCode: error.statusCode,
          details: error.details,
        });

        return c.json(
          {
            success: false,
            error: error.toJSON(),
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
            },
          },
          error.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500,
        );
      }

      // Unexpected error
      const err = error as Error;
      logger?.error('Unexpected error', {
        name: err.name,
        message: err.message,
        stack: isProduction ? undefined : err.stack,
      });

      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: isProduction ? 'Internal server error' : err.message,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        },
        500,
      );
    }
  };
}

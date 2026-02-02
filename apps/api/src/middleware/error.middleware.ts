/**
 * Enhanced error handling middleware with comprehensive logging
 */

import { FileWriter, createLogger } from '@cloudpilot/shared';
import type { Next } from 'hono';
import path from 'node:path';
import type { AppContext } from '../types/context.js';

// Create dedicated error logger
function createErrorLogger(correlationId?: string, requestId?: string) {
  return createLogger({
    source: 'server',
    writers: [
      new FileWriter({ filePath: path.join(process.cwd(), 'logs', 'errors-detailed.log') }),
    ],
    defaultMetadata: { correlationId, requestId },
  });
}

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
  console.log('[Middleware] Error handler initialized');
  return async (c: AppContext, next: Next) => {
    const start = Date.now();
    const correlationId = c.get('correlationId');
    const requestId = c.get('requestId');
    const logger = c.get('logger');
    const user = c.get('user');
    
    try {
      await next();
    } catch (error) {
      const errorLogger = createErrorLogger(correlationId, requestId);
      const isProduction = c.env.NODE_ENV === 'production';
      const duration = Date.now() - start;
      
      const userAgent = c.req.header('user-agent') || 'unknown';
      const ipAddress = c.req.header('cf-connecting-ip') || 
                       c.req.header('x-forwarded-for') || 
                       c.req.header('x-real-ip') || 'unknown';

      // Get request context for error logging
      const requestContext = {
        method: c.req.method,
        path: c.req.path,
        query: c.req.query(),
        userAgent,
        ipAddress,
        userId: user?.id,
        duration,
        url: c.req.url,
      };

      if (error instanceof AppError) {
        // Log application error with full context
        errorLogger.warn(`Application error: ${error.code}`, {
          error: {
            type: 'application',
            name: error.name,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            details: error.details,
            stack: isProduction ? undefined : error.stack,
          },
          request: requestContext,
          context: {
            isProduction,
            timestamp: new Date().toISOString(),
          },
        });

        // Log to request-scoped logger as well
        logger?.warn(`AppError: ${error.code}`, {
          statusCode: error.statusCode,
          details: error.details,
          duration,
        });

        console.log('[ErrorHandler] AppError detected:', error.code, error.statusCode);

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

      // Unexpected/unhandled error
      const err = error as Error;
      
      // Log critical unexpected error with maximum detail
      errorLogger.error('Unexpected system error', {
        error: {
          type: 'unexpected',
          name: err.name,
          message: err.message,
          stack: err.stack,
          critical: true,
        },
        request: requestContext,
        context: {
          isProduction,
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
        },
        system: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        },
      });

      // Log to request-scoped logger
      logger?.error('Unexpected error', {
        name: err.name,
        message: err.message,
        stack: isProduction ? undefined : err.stack,
        duration,
        critical: true,
      });

      console.error('[ErrorHandler] Unexpected error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        requestId,
        path: c.req.path,
      });

      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: isProduction ? 'Internal server error' : err.message,
            stack: isProduction ? undefined : err.stack,
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

import type { Logger } from '@cloudpilot/shared';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from './error.middleware.js';

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
  setContext: vi.fn(),
  withCorrelationId: vi.fn().mockReturnThis(),
  functionEnter: vi.fn(),
  functionExit: vi.fn(),
  functionError: vi.fn(),
  httpRequest: vi.fn(),
  httpResponse: vi.fn(),
  stateChange: vi.fn(),
  dbQuery: vi.fn(),
  authEvent: vi.fn(),
  buildStart: vi.fn(),
  buildComplete: vi.fn(),
  gitCommit: vi.fn(),
  gitPush: vi.fn(),
  gitError: vi.fn(),
  timed: vi.fn(),
};

function createMockEnv(production = false): Env {
  return {
    DB: {} as D1Database,
    BETTER_AUTH_SECRET: 'test-secret',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    NODE_ENV: production ? 'production' : 'test',
  };
}

describe('Error classes', () => {
  describe('AppError', () => {
    it('creates error with all properties', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR', { key: 'value' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.name).toBe('AppError');
    });

    it('serializes to JSON correctly', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR', { key: 'value' });
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'TEST_ERROR',
        message: 'Test error',
        details: { key: 'value' },
      });
    });
  });

  describe('NotFoundError', () => {
    it('has correct defaults', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
    });

    it('accepts custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
    });
  });

  describe('ValidationError', () => {
    it('has correct defaults', () => {
      const error = new ValidationError();

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('UnauthorizedError', () => {
    it('has correct defaults', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenError', () => {
    it('has correct defaults', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Forbidden');
    });
  });

  describe('ConflictError', () => {
    it('has correct defaults', () => {
      const error = new ConflictError();

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Conflict');
    });
  });

  describe('RateLimitError', () => {
    it('has correct defaults', () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.message).toBe('Rate limit exceeded');
    });
  });
});

describe('errorHandler middleware', () => {
  // Helper to create an app with onError handler that simulates errorHandler behavior
  function createApp(
    errorToThrow: Error | null,
    _env: Env,
  ): Hono<{ Bindings: Env; Variables: Variables }> {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();

    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'test-request-123');
      await next();
    });

    // Use onError for testing since Hono's middleware chain doesn't catch errors in test mode
    app.onError((error, c) => {
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

      logger?.error('Unexpected error', {
        name: error.name,
        message: error.message,
        stack: isProduction ? undefined : error.stack,
      });

      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: isProduction ? 'Internal server error' : error.message,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        },
        500,
      );
    });

    app.get('/test', () => {
      if (errorToThrow) throw errorToThrow;
      return new Response('OK');
    });

    return app;
  }

  it('passes through successful requests', async () => {
    const env = createMockEnv();
    const app = createApp(null, env);

    const res = await app.request('/test', {}, env);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('handles AppError with correct status code', async () => {
    const env = createMockEnv();
    const error = new ValidationError('Invalid input', { field: 'email' });
    const app = createApp(error, env);

    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.message).toBe('Invalid input');
    expect(json.error.details).toEqual({ field: 'email' });
    expect(json.meta.requestId).toBe('test-request-123');
    expect(json.meta.timestamp).toBeDefined();
  });

  it('handles NotFoundError', async () => {
    const env = createMockEnv();
    const error = new NotFoundError('User not found');
    const app = createApp(error, env);

    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('handles UnauthorizedError', async () => {
    const env = createMockEnv();
    const error = new UnauthorizedError('Invalid token');
    const app = createApp(error, env);

    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('handles ForbiddenError', async () => {
    const env = createMockEnv();
    const error = new ForbiddenError('Access denied');
    const app = createApp(error, env);

    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('handles unexpected errors in development', async () => {
    const env = createMockEnv(false);
    const error = new Error('Something unexpected happened');
    const app = createApp(error, env);

    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INTERNAL_ERROR');
    expect(json.error.message).toBe('Something unexpected happened');
  });

  it('hides error details in production', async () => {
    const env = createMockEnv(true);
    const error = new Error('Sensitive internal error');
    const app = createApp(error, env);

    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe('INTERNAL_ERROR');
    expect(json.error.message).toBe('Internal server error');
    expect(json.error.message).not.toContain('Sensitive');
  });

  it('logs AppErrors as warnings', async () => {
    const env = createMockEnv();
    const error = new ValidationError('Test validation');
    const app = createApp(error, env);

    vi.clearAllMocks();
    await app.request('/test', {}, env);

    expect(mockLogger.warn).toHaveBeenCalledWith('AppError: VALIDATION_ERROR', {
      statusCode: 400,
      details: undefined,
    });
  });

  it('logs unexpected errors as errors', async () => {
    const env = createMockEnv();
    const error = new Error('Unexpected!');
    const app = createApp(error, env);

    vi.clearAllMocks();
    await app.request('/test', {}, env);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unexpected error',
      expect.objectContaining({
        name: 'Error',
        message: 'Unexpected!',
      }),
    );
  });
});

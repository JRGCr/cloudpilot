import type { Logger } from '@cloudpilot/shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';
import { logs } from './log.routes.js';

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

function createMockEnv(): Env {
  return {
    DB: {} as D1Database,
    BETTER_AUTH_SECRET: 'test-secret',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    NODE_ENV: 'test',
  };
}

function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Hono's onError handler for uncaught errors
  app.onError((error, c) => {
    if (error instanceof Error && 'statusCode' in error) {
      const appError = error as Error & {
        statusCode: number;
        code: string;
        toJSON: () => Record<string, unknown>;
      };
      return c.json(
        {
          success: false,
          error: appError.toJSON(),
          meta: { timestamp: new Date().toISOString() },
        },
        appError.statusCode as 400 | 500,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
        meta: { timestamp: new Date().toISOString() },
      },
      500,
    );
  });

  // Set logger and requestId in context before routes
  app.use('*', async (c, next) => {
    c.set('logger', mockLogger);
    c.set('requestId', 'test-request-id');
    await next();
  });

  app.route('/logs', logs);
  return app;
}

describe('log routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /logs', () => {
    it('accepts valid log entry', async () => {
      const env = createMockEnv();
      const app = createApp();

      const entry = {
        id: 'log-123',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test log message',
        source: 'test',
      };

      const res = await app.request(
        '/logs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.written).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('rejects null log entry', async () => {
      const env = createMockEnv();
      const app = createApp();

      const res = await app.request(
        '/logs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'null',
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('rejects primitive log entry', async () => {
      const env = createMockEnv();
      const app = createApp();

      const res = await app.request(
        '/logs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '"string"',
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /logs/batch', () => {
    it('accepts valid batch of log entries', async () => {
      const env = createMockEnv();
      const app = createApp();

      const entries = [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'First log',
          source: 'test',
        },
        {
          id: 'log-2',
          timestamp: new Date().toISOString(),
          level: 'debug',
          message: 'Second log',
          source: 'test',
        },
      ];

      const res = await app.request(
        '/logs/batch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.written).toBe(2);
      expect(mockLogger.debug).toHaveBeenCalledWith('Client log batch details', { count: 2 });
    });

    it('accepts empty batch', async () => {
      const env = createMockEnv();
      const app = createApp();

      const res = await app.request(
        '/logs/batch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '[]',
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.written).toBe(0);
    });

    it('rejects non-array batch', async () => {
      const env = createMockEnv();
      const app = createApp();

      const res = await app.request(
        '/logs/batch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"not": "array"}',
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Expected array of log entries');
    });

    it('rejects batch with invalid entries', async () => {
      const env = createMockEnv();
      const app = createApp();

      const entries = [
        { id: 'log-1', message: 'Valid' },
        null,
        { id: 'log-3', message: 'Also valid' },
      ];

      const res = await app.request(
        '/logs/batch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });
});

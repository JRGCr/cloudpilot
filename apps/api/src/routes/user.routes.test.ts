import type { Logger, User } from '@cloudpilot/shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';
import { users } from './user.routes.js';

// Mock the user service
vi.mock('../services/user.service.js', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

import { deleteUser, getUser, updateUser } from '../services/user.service.js';

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

const mockUser: User = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
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

function createApp(authenticated = true) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Set up context
  app.use('*', async (c, next) => {
    c.set('logger', mockLogger);
    c.set('requestId', 'test-request-id');
    if (authenticated) {
      c.set('user', mockUser);
    }
    await next();
  });

  // Error handler
  app.onError((error, c) => {
    if (error instanceof Error && 'statusCode' in error) {
      const appError = error as Error & {
        statusCode: number;
        toJSON: () => Record<string, unknown>;
      };
      return c.json(
        {
          success: false,
          error: appError.toJSON(),
          meta: { timestamp: new Date().toISOString() },
        },
        appError.statusCode as 400 | 401 | 404 | 500,
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

  app.route('/users', users);
  return app;
}

describe('user routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('returns current user when authenticated', async () => {
      vi.mocked(getUser).mockResolvedValue({ _tag: 'Ok', value: mockUser });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request('/users/me', {}, env);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockUser);
    });

    it('returns 401 when not authenticated', async () => {
      const env = createMockEnv();
      const app = createApp(false);

      const res = await app.request('/users/me', {}, env);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 404 when user not found', async () => {
      vi.mocked(getUser).mockResolvedValue({
        _tag: 'Err',
        error: new Error('User not found'),
      });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request('/users/me', {}, env);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /users/me', () => {
    it('updates current user', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      vi.mocked(updateUser).mockResolvedValue({ _tag: 'Ok', value: updatedUser });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request(
        '/users/me',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Updated Name');
    });

    it('returns 401 when not authenticated', async () => {
      const env = createMockEnv();
      const app = createApp(false);

      const res = await app.request(
        '/users/me',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 404 when user not found', async () => {
      vi.mocked(updateUser).mockResolvedValue({
        _tag: 'Err',
        error: new Error('User not found'),
      });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request(
        '/users/me',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 on validation error', async () => {
      vi.mocked(updateUser).mockResolvedValue({
        _tag: 'Err',
        error: new Error('Invalid name format'),
      });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request(
        '/users/me',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '' }),
        },
        env,
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /users/me', () => {
    it('deletes current user', async () => {
      vi.mocked(deleteUser).mockResolvedValue({ _tag: 'Ok', value: undefined });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request('/users/me', { method: 'DELETE' }, env);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      const env = createMockEnv();
      const app = createApp(false);

      const res = await app.request('/users/me', { method: 'DELETE' }, env);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 404 when user not found', async () => {
      vi.mocked(deleteUser).mockResolvedValue({
        _tag: 'Err',
        error: new Error('User not found'),
      });

      const env = createMockEnv();
      const app = createApp(true);

      const res = await app.request('/users/me', { method: 'DELETE' }, env);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});

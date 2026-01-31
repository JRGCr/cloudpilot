import type { Logger } from '@cloudpilot/shared';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';
import { authMiddleware, requireAuth } from './auth.middleware.js';
import { errorHandler } from './error.middleware.js';

// Mock the auth service
vi.mock('../services/auth.js', () => ({
  createAuth: vi.fn(),
}));

import { createAuth } from '../services/auth.js';

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

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets user and session when valid session exists', async () => {
    const mockSession = {
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        image: 'https://example.com/avatar.jpg',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
      session: {
        id: 'session-123',
        userId: 'user-123',
        token: 'test-token',
        expiresAt: new Date('2025-01-01'),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    };

    vi.mocked(createAuth).mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as ReturnType<typeof createAuth>);

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      await next();
    });
    app.use('*', authMiddleware());
    app.get('/test', (c) => {
      const user = c.get('user');
      const session = c.get('session');
      return c.json({ user, session });
    });

    const env = createMockEnv();
    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.id).toBe('user-123');
    expect(json.user.name).toBe('Test User');
    expect(json.user.email).toBe('test@example.com');
    expect(json.session.id).toBe('session-123');
    expect(mockLogger.authEvent).toHaveBeenCalledWith('session_validated', 'user-123');
  });

  it('continues without setting user when no session', async () => {
    vi.mocked(createAuth).mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ReturnType<typeof createAuth>);

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      await next();
    });
    app.use('*', authMiddleware());
    app.get('/test', (c) => {
      const user = c.get('user');
      return c.json({ hasUser: !!user });
    });

    const env = createMockEnv();
    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.hasUser).toBe(false);
  });

  it('continues when session check throws error', async () => {
    vi.mocked(createAuth).mockReturnValue({
      api: {
        getSession: vi.fn().mockRejectedValue(new Error('Auth service unavailable')),
      },
    } as unknown as ReturnType<typeof createAuth>);

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      await next();
    });
    app.use('*', authMiddleware());
    app.get('/test', (c) => {
      const user = c.get('user');
      return c.json({ hasUser: !!user });
    });

    const env = createMockEnv();
    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.hasUser).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith('No valid session', {
      error: 'Auth service unavailable',
    });
  });

  it('handles partial session (user only)', async () => {
    const mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
      session: null,
    };

    vi.mocked(createAuth).mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as ReturnType<typeof createAuth>);

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      await next();
    });
    app.use('*', authMiddleware());
    app.get('/test', (c) => {
      const user = c.get('user');
      return c.json({ hasUser: !!user });
    });

    const env = createMockEnv();
    const res = await app.request('/test', {}, env);
    const json = await res.json();

    // When session object is null, user shouldn't be set
    expect(json.hasUser).toBe(false);
  });
});

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when user is authenticated', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'test-id');
      c.set('user', {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        image: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      await next();
    });
    app.use('*', errorHandler());
    app.use('*', requireAuth());
    app.get('/test', () => new Response('Protected content'));

    const env = createMockEnv();
    const res = await app.request('/test', {}, env);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Protected content');
  });

  it('returns 401 when user is not authenticated', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'test-id');
      await next();
    });
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
          appError.statusCode as 401,
        );
      }
      return c.json({ success: false, error: { message: error.message } }, 500);
    });
    app.use('*', requireAuth());
    app.get('/test', () => new Response('Protected content'));

    const env = createMockEnv();
    const res = await app.request('/test', {}, env);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
    expect(json.error.message).toBe('Authentication required');
  });

  it('logs unauthorized access attempt', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'test-id');
      await next();
    });
    app.onError(() => new Response('Error', { status: 401 }));
    app.use('*', requireAuth());
    app.get('/test', () => new Response('Protected content'));

    const env = createMockEnv();
    vi.clearAllMocks();
    await app.request('/test', {}, env);

    expect(mockLogger.authEvent).toHaveBeenCalledWith('unauthorized_access');
  });
});

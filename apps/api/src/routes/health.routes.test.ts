import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';
import { health } from './health.routes.js';

function createMockEnv(dbHealthy = true): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (dbHealthy) return Promise.resolve({ 1: 1 });
          return Promise.reject(new Error('Database unavailable'));
        }),
        run: vi.fn(),
        all: vi.fn(),
        bind: vi.fn().mockReturnThis(),
      }),
      dump: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn(),
    } as unknown as D1Database,
    BETTER_AUTH_SECRET: 'test-secret',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    NODE_ENV: 'test',
  };
}

function createApp(_env: Env) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.route('/health', health);
  return app;
}

describe('health routes', () => {
  describe('GET /health', () => {
    it('returns healthy status when database is available', async () => {
      const env = createMockEnv(true);
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.service).toBe('cloudpilot-api');
      expect(json.data.version).toBe('dev');
      expect(json.data.database).toBe('healthy');
      expect(json.data.environment).toBe('test');
      expect(json.meta.timestamp).toBeDefined();
    });

    it('returns unhealthy database status when database fails', async () => {
      const env = createMockEnv(false);
      const app = createApp(env);

      const res = await app.request('/health', {}, env);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.database).toBe('unhealthy');
    });
  });

  describe('GET /health/live', () => {
    it('returns alive status', async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request('/health/live', {}, env);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('alive');
      expect(json.meta.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('returns ready when database is available', async () => {
      const env = createMockEnv(true);
      const app = createApp(env);

      const res = await app.request('/health/ready', {}, env);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ready');
    });

    it('returns 503 when database is unavailable', async () => {
      const env = createMockEnv(false);
      const app = createApp(env);

      const res = await app.request('/health/ready', {}, env);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_READY');
      expect(json.error.message).toBe('Database unavailable');
    });
  });
});

/**
 * Health check routes
 */

import { Hono } from 'hono';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const health = new Hono<{ Bindings: Env; Variables: Variables }>();

// Root health check
health.get('/', async (c) => {
  let dbStatus = 'unknown';
  try {
    await c.env.DB.prepare('SELECT 1').first();
    dbStatus = 'healthy';
  } catch {
    dbStatus = 'unhealthy';
  }

  const buildVersion = c.env.BUILD_VERSION || 'dev';
  const buildTime = c.env.BUILD_TIME || new Date().toISOString();

  // Log version on first health check
  const logger = c.get('logger');
  logger?.info('CloudPilot API health check', {
    buildVersion,
    buildTime,
    environment: c.env.NODE_ENV ?? 'development',
  });

  return c.json({
    success: true,
    data: {
      service: 'cloudpilot-api',
      version: buildVersion,
      buildTime,
      environment: c.env.NODE_ENV ?? 'development',
      database: dbStatus,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Liveness probe
health.get('/live', (c) => {
  return c.json({
    success: true,
    data: { status: 'alive' },
    meta: { timestamp: new Date().toISOString() },
  });
});

// Readiness probe
health.get('/ready', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({
      success: true,
      data: { status: 'ready' },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_READY', message: 'Database unavailable' },
        meta: { timestamp: new Date().toISOString() },
      },
      503,
    );
  }
});

export { health };

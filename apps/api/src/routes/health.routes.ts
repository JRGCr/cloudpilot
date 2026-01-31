/**
 * Health check routes
 */

import { Hono } from 'hono';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const health = new Hono<{ Bindings: Env; Variables: Variables }>();

console.log('[Routes] Health routes initialized');

// Root health check
health.get('/', async (c) => {
  console.log('[Health] Root health check requested');

  let dbStatus = 'unknown';
  try {
    console.log('[Health] Testing database connection...');
    await c.env.DB.prepare('SELECT 1').first();
    dbStatus = 'healthy';
    console.log('[Health] Database is healthy');
  } catch (error) {
    console.error('[Health] Database check failed:', error);
    dbStatus = 'unhealthy';
  }

  const buildVersion = c.env.BUILD_VERSION || 'dev';
  const buildTime = c.env.BUILD_TIME || new Date().toISOString();

  console.log('[Health] Build info:', { buildVersion, buildTime });

  // Log version on first health check
  const logger = c.get('logger');
  logger?.info('CloudPilot API health check', {
    buildVersion,
    buildTime,
    environment: c.env.NODE_ENV ?? 'development',
  });

  const response = {
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
  };

  console.log('[Health] Returning response:', response);
  return c.json(response);
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

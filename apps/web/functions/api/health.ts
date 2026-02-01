/**
 * Health check endpoint for Cloudflare Pages Functions
 */

import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  NODE_ENV?: string;
  BUILD_VERSION?: string;
  BUILD_TIME?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  console.log('[Pages Health] Health check requested');

  let dbStatus = 'unknown';
  try {
    console.log('[Pages Health] Testing database connection...');
    await env.DB.prepare('SELECT 1').first();
    dbStatus = 'healthy';
    console.log('[Pages Health] Database is healthy');
  } catch (error) {
    console.error('[Pages Health] Database check failed:', error);
    dbStatus = 'unhealthy';
  }

  const buildVersion = env.BUILD_VERSION || 'dev';
  const buildTime = env.BUILD_TIME || new Date().toISOString();

  console.log('[Pages Health] Build info:', { buildVersion, buildTime });

  const response = {
    success: true,
    data: {
      service: 'cloudpilot-api',
      version: buildVersion,
      buildTime,
      environment: env.NODE_ENV ?? 'development',
      database: dbStatus,
      deployment: 'pages-functions',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  console.log('[Pages Health] Returning response:', response);

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

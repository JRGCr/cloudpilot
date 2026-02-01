/**
 * Health check endpoint for Cloudflare Pages Functions
 */

import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  NODE_ENV?: string;
  BUILD_VERSION?: string;
  BUILD_TIME?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
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

  // Check auth configuration
  const authConfig = {
    hasBetterAuthSecret: !!env.BETTER_AUTH_SECRET,
    hasBetterAuthURL: !!env.BETTER_AUTH_URL,
    hasGitHubClientId: !!env.GITHUB_CLIENT_ID,
    hasGitHubClientSecret: !!env.GITHUB_CLIENT_SECRET,
    betterAuthURL: env.BETTER_AUTH_URL || 'NOT_SET',
  };

  const missingEnvVars = [
    !env.BETTER_AUTH_SECRET && 'BETTER_AUTH_SECRET',
    !env.BETTER_AUTH_URL && 'BETTER_AUTH_URL',
    !env.GITHUB_CLIENT_ID && 'GITHUB_CLIENT_ID',
    !env.GITHUB_CLIENT_SECRET && 'GITHUB_CLIENT_SECRET',
  ].filter(Boolean);

  console.log('[Pages Health] Auth config:', authConfig);
  console.log('[Pages Health] Missing env vars:', missingEnvVars);

  const response = {
    success: true,
    data: {
      service: 'cloudpilot-api',
      version: buildVersion,
      buildTime,
      environment: env.NODE_ENV ?? 'development',
      database: dbStatus,
      deployment: 'pages-functions',
      auth: {
        configured: missingEnvVars.length === 0,
        missingEnvVars,
        betterAuthURL: env.BETTER_AUTH_URL || 'NOT_SET',
      },
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

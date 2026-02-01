/**
 * Simple health check endpoint to verify Pages Functions are working
 */

import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  NODE_ENV?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  console.log('[Health] Health check request:', request.method, url.pathname);

  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      environment: {
        hasDb: !!env.DB,
        hasAuthSecret: !!env.BETTER_AUTH_SECRET,
        hasAuthUrl: !!env.BETTER_AUTH_URL,
        hasGithubId: !!env.GITHUB_CLIENT_ID,
        hasGithubSecret: !!env.GITHUB_CLIENT_SECRET,
        nodeEnv: env.NODE_ENV || 'unknown',
      },
    };

    console.log('[Health] Health response:', health);

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Health] Health check error:', error);
    
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
};
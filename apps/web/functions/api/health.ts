/**
 * Simple health check endpoint to verify Pages Functions are working
 */

import type { PagesFunction, D1Database } from '@cloudflare/workers-types';
import { createPagesLogger } from '@cloudpilot/shared/logging/cloudflare-logger';

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
  const start = Date.now();

  // Create comprehensive logger for health check
  const logger = createPagesLogger(env, request, 'health-check');

  logger.pagesRequest(request as any, {
    health: {
      step: 'health_check_start',
      path: url.pathname,
    },
  });

  console.log('[Health] Health check request:', request.method, url.pathname);

  try {
    const health = await logger.trackPagesFunction('health-check-execution', async () => {
      const healthData = {
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
        correlationId: logger.correlationId,
        requestId: logger.requestId,
      };

      logger.info('Health check environment validation', {
        health: {
          step: 'environment_check',
          ...healthData.environment,
        },
      });

      return healthData;
    });

    console.log('[Health] Health response:', health);

    const response = new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });

    const duration = Date.now() - start;
    logger.pagesResponse(response, duration, {
      health: {
        step: 'health_check_success',
        environmentStatus: health.environment,
      },
    });

    return response;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.pagesError(error as Error, request as any, {
      health: {
        step: 'health_check_error',
        duration,
        critical: false,
      },
    });

    console.error('[Health] Health check error:', error);
    
    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: logger.correlationId,
      requestId: logger.requestId,
    };

    const response = new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });

    logger.pagesResponse(response, duration, {
      health: {
        step: 'health_check_error_response',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
    });

    return response;
  }
};
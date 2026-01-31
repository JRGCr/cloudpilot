/**
 * Authentication routes - mounts Better Auth handler
 */

import { Hono } from 'hono';
import { createAuth } from '../services/auth.js';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mount Better Auth handler for all auth routes
auth.all('/*', async (c) => {
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  try {
    logger?.debug('Creating Better Auth instance', {
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    const authInstance = createAuth(c.env);

    logger?.debug('Calling Better Auth handler', { requestId });
    const response = await authInstance.handler(c.req.raw);

    logger?.debug('Better Auth handler completed', {
      requestId,
      status: response.status,
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger?.error('Better Auth handler error', {
      requestId,
      error: errorMessage,
      stack: errorStack,
      path: c.req.path,
      method: c.req.method,
    });

    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication service error',
          details: { message: errorMessage },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      500,
    );
  }
});

export { auth };

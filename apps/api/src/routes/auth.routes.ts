/**
 * Authentication routes - mounts Better Auth handler
 */

import { Hono } from 'hono';
import { createAuth } from '../services/auth.js';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

console.log('[Routes] Auth routes initialized');

// Flag to log configuration only once
let hasLoggedConfig = false;

// Mount Better Auth handler for all auth routes
auth.all('/*', async (c) => {
  console.log('[Auth] Request received:', c.req.method, c.req.path);

  const logger = c.get('logger');
  const requestId = c.get('requestId');

  // Log configuration on first request
  if (!hasLoggedConfig && logger) {
    const trustedOrigins = c.env.TRUSTED_ORIGINS || '(using defaults)';
    console.log('[Auth] First request - logging configuration');
    logger.info('Better Auth configuration', {
      requestId,
      trustedOrigins,
      baseURL: c.env.BETTER_AUTH_URL,
      nodeEnv: c.env.NODE_ENV,
    });
    hasLoggedConfig = true;
  }

  // Log incoming request details
  console.log('[Auth] Request details:', {
    requestId,
    path: c.req.path,
    method: c.req.method,
    origin: c.req.header('origin'),
    referer: c.req.header('referer'),
  });
  logger?.debug('Better Auth request', {
    requestId,
    path: c.req.path,
    method: c.req.method,
    origin: c.req.header('origin'),
    referer: c.req.header('referer'),
    userAgent: c.req.header('user-agent'),
  });

  try {
    console.log('[Auth] Creating auth instance...');
    const authInstance = createAuth(c.env);
    console.log('[Auth] Auth instance created, calling handler...');

    const response = await authInstance.handler(c.req.raw);
    console.log('[Auth] Handler returned, status:', response.status);

    // Log Better Auth response (including body for debugging 500s)
    const clonedResponse = response.clone();
    const bodyText = await clonedResponse.text();

    console.log('[Auth] Response body length:', bodyText.length);
    console.log('[Auth] Response preview:', bodyText.substring(0, 200));

    logger?.debug('Better Auth response', {
      requestId,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      bodyLength: bodyText.length,
      bodyPreview: bodyText.substring(0, 500),
    });

    // If 500, log as error with full details
    if (response.status === 500) {
      console.error('[Auth] 500 ERROR from Better Auth:', bodyText);
      logger?.error('Better Auth returned 500', {
        requestId,
        bodyText,
        headers: Object.fromEntries(response.headers.entries()),
      });
    }

    console.log('[Auth] Returning response');
    // Return Better Auth response directly without modification
    // This preserves proper HTTP status codes (302, 404, 400, etc.)
    return response;
  } catch (error) {
    // Temporary: return error details for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    };

    console.error('[Auth] EXCEPTION in auth route:', errorDetails);
    logger?.error('Better Auth exception thrown', { requestId, error: errorDetails });

    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication error',
          details: errorDetails,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      500,
    );
  }
});

export { auth };

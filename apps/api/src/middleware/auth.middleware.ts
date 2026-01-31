/**
 * Authentication middleware
 */

import type { Next } from 'hono';
import { createAuth } from '../services/auth.js';
import type { AppContext } from '../types/context.js';
import { UnauthorizedError } from './error.middleware.js';

export function authMiddleware() {
  console.log('[Middleware] Auth middleware initialized');
  return async (c: AppContext, next: Next) => {
    console.log('[AuthMiddleware] Processing request:', c.req.method, c.req.path);

    try {
      console.log('[AuthMiddleware] Creating auth instance...');
      const auth = createAuth(c.env);
      console.log('[AuthMiddleware] Auth instance created successfully');

      const logger = c.get('logger');

      try {
        console.log('[AuthMiddleware] Fetching session...');
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        console.log('[AuthMiddleware] Session fetched:', !!session);

        if (session?.user && session?.session) {
          console.log('[AuthMiddleware] Valid session found for user:', session.user.id);
          c.set('user', {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email,
            emailVerified: session.user.emailVerified ?? false,
            image: session.user.image ?? null,
            createdAt: session.user.createdAt?.toISOString() ?? new Date().toISOString(),
            updatedAt: session.user.updatedAt?.toISOString() ?? new Date().toISOString(),
          });
          c.set('session', {
            id: session.session.id,
            userId: session.session.userId,
            token: session.session.token,
            expiresAt: session.session.expiresAt.toISOString(),
            ipAddress: session.session.ipAddress ?? null,
            userAgent: session.session.userAgent ?? null,
            createdAt: session.session.createdAt?.toISOString() ?? new Date().toISOString(),
            updatedAt: session.session.updatedAt?.toISOString() ?? new Date().toISOString(),
          });
          logger?.authEvent('session_validated', session.user.id);
        } else {
          console.log('[AuthMiddleware] No valid session found');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log('[AuthMiddleware] Session fetch error (non-fatal):', errorMessage);
        logger?.debug('No valid session', { error: errorMessage });
      }

      console.log('[AuthMiddleware] Proceeding to next middleware');
      await next();
      console.log('[AuthMiddleware] Request completed');
    } catch (error) {
      console.error('[AuthMiddleware] FATAL ERROR:', error);
      throw error;
    }
  };
}

export function requireAuth() {
  return async (c: AppContext, next: Next) => {
    const user = c.get('user');
    const logger = c.get('logger');

    if (!user) {
      logger?.authEvent('unauthorized_access');
      throw new UnauthorizedError('Authentication required');
    }

    await next();
  };
}

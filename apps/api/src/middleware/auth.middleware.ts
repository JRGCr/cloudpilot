/**
 * Authentication middleware
 */

import type { Next } from 'hono';
import { createAuth } from '../services/auth.js';
import type { AppContext } from '../types/context.js';
import { UnauthorizedError } from './error.middleware.js';

export function authMiddleware() {
  return async (c: AppContext, next: Next) => {
    const auth = createAuth(c.env);

    const logger = c.get('logger');

    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (session?.user && session?.session) {
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
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger?.debug('No valid session', { error: errorMessage });
    }
    await next();
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

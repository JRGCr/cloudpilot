/**
 * Enhanced authentication middleware with comprehensive logging
 */

import { FileWriter, createLogger } from '@cloudpilot/shared';
import type { Next } from 'hono';
import path from 'node:path';
import { createAuth } from '../services/auth.js';
import type { AppContext } from '../types/context.js';
import { UnauthorizedError } from './error.middleware.js';

// Create dedicated auth logger
function createAuthLogger(correlationId?: string, requestId?: string) {
  return createLogger({
    source: 'auth',
    writers: [
      new FileWriter({ filePath: path.join(process.cwd(), 'logs', 'auth.log') }),
    ],
    defaultMetadata: { correlationId, requestId },
  });
}

export function authMiddleware() {
  console.log('[Middleware] Auth middleware initialized');
  return async (c: AppContext, next: Next) => {
    const correlationId = c.get('correlationId');
    const requestId = c.get('requestId');
    const logger = c.get('logger');
    const authLogger = createAuthLogger(correlationId, requestId);
    const start = Date.now();

    const userAgent = c.req.header('user-agent') || 'unknown';
    const ipAddress = c.req.header('cf-connecting-ip') || 
                     c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 'unknown';

    authLogger.info('Authentication middleware started', {
      auth: {
        step: 'middleware_start',
        path: c.req.path,
        method: c.req.method,
        userAgent,
        ipAddress,
        hasAuthorizationHeader: !!c.req.header('authorization'),
        hasCookieHeader: !!c.req.header('cookie'),
      },
    });

    try {
      authLogger.debug('Creating auth instance');
      const auth = createAuth(c.env);
      authLogger.debug('Auth instance created successfully');

      try {
        const sessionStart = Date.now();
        authLogger.info('Starting session validation', {
          auth: {
            step: 'session_validation_start',
            ipAddress,
            userAgent,
          },
        });

        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });

        const sessionDuration = Date.now() - sessionStart;

        if (session?.user && session?.session) {
          authLogger.info('Session validation successful', {
            auth: {
              step: 'session_validation_success',
              userId: session.user.id,
              userEmail: session.user.email,
              sessionId: session.session.id,
              sessionExpiresAt: session.session.expiresAt.toISOString(),
              emailVerified: session.user.emailVerified ?? false,
              ipAddress,
              userAgent,
              duration: sessionDuration,
            },
          });

          // Set user context
          c.set('user', {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email,
            emailVerified: session.user.emailVerified ?? false,
            image: session.user.image ?? null,
            createdAt: session.user.createdAt?.toISOString() ?? new Date().toISOString(),
            updatedAt: session.user.updatedAt?.toISOString() ?? new Date().toISOString(),
          });

          // Set session context
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

          // Log to request-scoped logger as well
          logger?.authEvent('session_validated', session.user.id, {
            sessionId: session.session.id,
            duration: sessionDuration,
          });

        } else {
          authLogger.info('Session validation failed - no valid session', {
            auth: {
              step: 'session_validation_failed',
              reason: 'no_valid_session',
              hasSession: !!session,
              hasUser: !!session?.user,
              hasSessionData: !!session?.session,
              ipAddress,
              userAgent,
              duration: sessionDuration,
            },
          });

          logger?.debug('No valid session found', { 
            duration: sessionDuration,
            sessionData: !!session,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        
        authLogger.warn('Session validation error', {
          auth: {
            step: 'session_validation_error',
            error: {
              name: errorName,
              message: errorMessage,
            },
            ipAddress,
            userAgent,
            fatal: false,
          },
        });

        logger?.debug('Session fetch error (non-fatal)', { 
          error: errorMessage,
          errorType: errorName,
        });
      }

      await next();

      const totalDuration = Date.now() - start;
      const user = c.get('user');
      
      authLogger.info('Authentication middleware completed', {
        auth: {
          step: 'middleware_complete',
          authenticated: !!user,
          userId: user?.id,
          duration: totalDuration,
          path: c.req.path,
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      authLogger.error('Authentication middleware fatal error', {
        auth: {
          step: 'middleware_fatal_error',
          error: {
            name: errorName,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          },
          path: c.req.path,
          ipAddress,
          userAgent,
        },
      });

      console.error('[AuthMiddleware] FATAL ERROR:', error);
      throw error;
    }
  };
}

export function requireAuth() {
  return async (c: AppContext, next: Next) => {
    const user = c.get('user');
    const session = c.get('session');
    const logger = c.get('logger');
    const correlationId = c.get('correlationId');
    const requestId = c.get('requestId');
    const authLogger = createAuthLogger(correlationId, requestId);

    const userAgent = c.req.header('user-agent') || 'unknown';
    const ipAddress = c.req.header('cf-connecting-ip') || 
                     c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 'unknown';

    authLogger.info('Authorization check started', {
      auth: {
        step: 'authorization_check',
        path: c.req.path,
        method: c.req.method,
        hasUser: !!user,
        hasSession: !!session,
        ipAddress,
        userAgent,
      },
    });

    if (!user) {
      authLogger.warn('Authorization failed - no authenticated user', {
        auth: {
          step: 'authorization_failed',
          reason: 'no_authenticated_user',
          path: c.req.path,
          method: c.req.method,
          ipAddress,
          userAgent,
          hasSession: !!session,
        },
      });

      logger?.authEvent('unauthorized_access', undefined, {
        path: c.req.path,
        method: c.req.method,
        ipAddress,
      });

      throw new UnauthorizedError('Authentication required');
    }

    authLogger.info('Authorization successful', {
      auth: {
        step: 'authorization_success',
        userId: user.id,
        userEmail: user.email,
        path: c.req.path,
        method: c.req.method,
        ipAddress,
        userAgent,
      },
    });

    logger?.authEvent('authorized_access', user.id, {
      path: c.req.path,
      method: c.req.method,
    });

    await next();
  };
}

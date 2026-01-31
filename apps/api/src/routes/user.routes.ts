/**
 * User routes - protected routes for user management
 */

import { isOk } from '@cloudpilot/shared';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import { deleteUser, getUser, updateUser } from '../services/user.service.js';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
users.use('*', requireAuth());

// Get current user
users.get('/me', async (c) => {
  const user = c.get('user');
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  if (!user) {
    logger?.warn('Unauthenticated user access attempt', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  logger.info('Fetching current user profile', { userId: user.id, requestId });

  const result = await getUser(c.env.DB, user.id, logger);

  if (!isOk(result)) {
    logger.warn('User profile fetch failed', {
      userId: user.id,
      requestId,
      error: result.error.message,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      404,
    );
  }

  logger.info('User profile fetched successfully', { userId: user.id, requestId });

  return c.json({
    success: true,
    data: result.value,
    meta: { requestId, timestamp: new Date().toISOString() },
  });
});

// Update current user
users.patch('/me', async (c) => {
  const user = c.get('user');
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  if (!user) {
    logger?.warn('Unauthenticated user update attempt', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  const updates = await c.req.json<{ name?: string; image?: string }>();

  logger.info('Updating user profile', {
    userId: user.id,
    requestId,
    fields: Object.keys(updates),
  });

  const result = await updateUser(c.env.DB, user.id, updates, logger);

  if (!isOk(result)) {
    logger.warn('User profile update failed', {
      userId: user.id,
      requestId,
      error: result.error.message,
    });

    const isNotFound = result.error.message.includes('not found');
    return c.json(
      {
        success: false,
        error: {
          code: isNotFound ? 'NOT_FOUND' : 'VALIDATION_ERROR',
          message: isNotFound ? 'User not found' : result.error.message,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      isNotFound ? 404 : 400,
    );
  }

  logger.info('User profile updated successfully', { userId: user.id, requestId });

  return c.json({
    success: true,
    data: result.value,
    meta: { requestId, timestamp: new Date().toISOString() },
  });
});

// Delete current user
users.delete('/me', async (c) => {
  const user = c.get('user');
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  if (!user) {
    logger?.warn('Unauthenticated user deletion attempt', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  logger.warn('Deleting user account', { userId: user.id, requestId });

  const result = await deleteUser(c.env.DB, user.id, logger);

  if (!isOk(result)) {
    logger.error('User account deletion failed', {
      userId: user.id,
      requestId,
      error: result.error.message,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      404,
    );
  }

  logger.warn('User account deleted successfully', { userId: user.id, requestId });

  return c.json({
    success: true,
    data: { deleted: true },
    meta: { requestId, timestamp: new Date().toISOString() },
  });
});

export { users };

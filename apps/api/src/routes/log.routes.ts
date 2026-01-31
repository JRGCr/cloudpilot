/**
 * Log routes - receives client logs
 */

import { isOk } from '@cloudpilot/shared';
import { Hono } from 'hono';
import { writeLog, writeLogs } from '../services/log.service.js';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const logs = new Hono<{ Bindings: Env; Variables: Variables }>();

// Receive single log entry
logs.post('/', async (c) => {
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  logger?.info('Log write request received', { requestId });

  const entry = await c.req.json();
  const result = await writeLog(entry, logger);

  if (!isOk(result)) {
    logger?.warn('Log write failed', { requestId, error: result.error.message });
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to write log',
          details: { error: result.error.message },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      400,
    );
  }

  logger?.info('Log write successful', { requestId });

  return c.json({
    success: true,
    data: { written: 1 },
    meta: { requestId, timestamp: new Date().toISOString() },
  });
});

// Receive batch of log entries
logs.post('/batch', async (c) => {
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  logger?.info('Log batch write request received', { requestId });

  const entries = await c.req.json<unknown[]>();

  if (!Array.isArray(entries)) {
    logger?.warn('Invalid batch request: not an array', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Expected array of log entries',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      400,
    );
  }

  const result = await writeLogs(entries, logger);

  if (!isOk(result)) {
    logger?.warn('Log batch write failed', {
      requestId,
      count: entries.length,
      error: result.error.message,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to write logs',
          details: { error: result.error.message },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      400,
    );
  }

  logger?.info('Log batch write successful', { requestId, count: entries.length });

  return c.json({
    success: true,
    data: { written: entries.length },
    meta: { requestId, timestamp: new Date().toISOString() },
  });
});

export { logs };

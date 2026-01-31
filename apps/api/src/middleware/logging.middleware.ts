/**
 * Logging middleware - creates request-scoped logger
 */

import { ConsoleWriter, type LogLevel, createLogger } from '@cloudpilot/shared';
import type { Next } from 'hono';
import { nanoid } from 'nanoid';
import type { AppContext } from '../types/context.js';

export function loggingMiddleware() {
  return async (c: AppContext, next: Next) => {
    const requestId = nanoid();
    const correlationId = c.req.header('x-correlation-id') ?? nanoid();

    // Create request-scoped logger
    const logger = createLogger({
      source: 'server',
      writers: [new ConsoleWriter({ expandMetadata: c.env.NODE_ENV !== 'production' })],
      minLevel: (c.env.LOG_LEVEL as LogLevel) ?? 'debug',
      defaultMetadata: { requestId, correlationId },
    });

    c.set('requestId', requestId);
    c.set('correlationId', correlationId);
    c.set('logger', logger);

    const start = Date.now();
    const { method } = c.req;
    const url = new URL(c.req.url).pathname;

    logger.httpRequest(method, url);

    await next();

    const duration = Date.now() - start;
    logger.httpResponse(c.res.status, duration);

    // Add request ID to response headers
    c.header('X-Request-Id', requestId);
  };
}

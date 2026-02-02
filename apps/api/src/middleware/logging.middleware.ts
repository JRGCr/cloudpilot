/**
 * Enhanced logging middleware - creates request-scoped logger with file output
 */

import { ConsoleWriter, FileWriter, type LogLevel, createLogger } from '@cloudpilot/shared';
import type { Next } from 'hono';
import { nanoid } from 'nanoid';
import path from 'node:path';
import type { AppContext } from '../types/context.js';

export function loggingMiddleware() {
  return async (c: AppContext, next: Next) => {
    const requestId = nanoid();
    const correlationId = c.req.header('x-correlation-id') ?? nanoid();
    const start = Date.now();
    const { method } = c.req;
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    const queryString = url.search;
    const userAgent = c.req.header('user-agent') || 'unknown';
    const ipAddress = c.req.header('cf-connecting-ip') || 
                     c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 'unknown';

    // Create request-scoped logger with both console and file writers
    const writers = [
      new ConsoleWriter({ expandMetadata: c.env.NODE_ENV !== 'production' }),
      new FileWriter({ filePath: path.join(process.cwd(), 'logs', 'requests.log') }),
    ];

    const logger = createLogger({
      source: 'server',
      writers,
      minLevel: (c.env.LOG_LEVEL as LogLevel) ?? 'debug',
      defaultMetadata: { requestId, correlationId },
    });

    c.set('requestId', requestId);
    c.set('correlationId', correlationId);
    c.set('logger', logger);

    // Log detailed request information
    const requestHeaders = Object.fromEntries(
      Object.entries(c.req.header()).filter(([key]) => 
        !key.toLowerCase().includes('authorization') && 
        !key.toLowerCase().includes('cookie') &&
        !key.toLowerCase().includes('secret')
      )
    );

    // Get request body size if available
    const contentLength = c.req.header('content-length');
    const bodySize = contentLength ? parseInt(contentLength, 10) : undefined;

    logger.info(`Request started: ${method} ${pathname}`, {
      request: {
        method,
        path: pathname,
        query: queryString,
        userAgent,
        ipAddress,
        bodySize,
        headers: requestHeaders,
      },
    });

    // Track request processing
    let responseBody: unknown;
    let responseSize: number | undefined;
    
    await next();

    const duration = Date.now() - start;
    const status = c.res.status;
    
    // Get response headers (excluding sensitive ones)
    const responseHeaders = Object.fromEntries(
      Array.from(c.res.headers.entries()).filter(([key]) => 
        !key.toLowerCase().includes('authorization') && 
        !key.toLowerCase().includes('cookie') &&
        !key.toLowerCase().includes('secret')
      )
    );

    // Try to get response size from content-length header
    const responseContentLength = c.res.headers.get('content-length');
    responseSize = responseContentLength ? parseInt(responseContentLength, 10) : undefined;

    // Log detailed response information
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logger.log(level, `Request completed: ${method} ${pathname} ${status}`, {
      request: {
        method,
        path: pathname,
        query: queryString,
        userAgent,
        ipAddress,
        bodySize,
      },
      response: {
        status,
        size: responseSize,
        headers: responseHeaders,
      },
      timing: {
        duration,
        slow: duration > 1000, // Mark slow requests
      },
    });

    // Log performance warning for slow requests
    if (duration > 2000) {
      logger.warn(`Slow request detected: ${method} ${pathname}`, {
        performance: {
          duration,
          threshold: 2000,
          slowRequestAlert: true,
        },
      });
    }

    // Add request ID to response headers
    c.header('X-Request-Id', requestId);
  };
}

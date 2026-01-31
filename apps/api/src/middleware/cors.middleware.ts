/**
 * CORS middleware configuration
 */

import { cors } from 'hono/cors';

export function corsMiddleware() {
  return cors({
    origin: (origin) => {
      // Allow localhost in development
      if (origin?.includes('localhost')) return origin;
      // Allow cloudpilot domains
      if (origin?.includes('cloudpilot')) return origin;
      // Allow pages.dev preview URLs
      if (origin?.includes('pages.dev')) return origin;
      // Allow workers.dev URLs
      if (origin?.includes('workers.dev')) return origin;
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposeHeaders: ['X-Request-Id'],
  });
}

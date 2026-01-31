/**
 * CloudPilot API - Entry point
 */

import { Hono } from 'hono';
import { authMiddleware } from './middleware/auth.middleware.js';
import { corsMiddleware, errorHandler, loggingMiddleware } from './middleware/index.js';
import { authProxy } from './routes/auth-proxy.routes.js';
import { auth } from './routes/auth.routes.js';
import { health } from './routes/health.routes.js';
import { logs } from './routes/log.routes.js';
import { users } from './routes/user.routes.js';
import type { Variables } from './types/context.js';
import type { Env } from './types/env.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use('*', errorHandler());
app.use('*', corsMiddleware());
app.use('*', loggingMiddleware());
app.use('*', authMiddleware());
app.route('/', health);
app.route('/auth', auth);
app.route('/auth-proxy', authProxy);
app.route('/users', users);
app.route('/logs', logs);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    404,
  );
});

export default app;

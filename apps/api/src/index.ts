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

console.log('[App] Initializing CloudPilot API...');

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

console.log('[App] Hono instance created');

// Global middleware (order matters)
console.log('[App] Registering middleware...');
app.use('*', errorHandler());
console.log('[App] - errorHandler registered');
app.use('*', corsMiddleware());
console.log('[App] - corsMiddleware registered');
app.use('*', loggingMiddleware());
console.log('[App] - loggingMiddleware registered');
app.use('*', authMiddleware());
console.log('[App] - authMiddleware registered');

// Mount routes
console.log('[App] Mounting routes...');
app.route('/', health);
console.log('[App] - health routes mounted at /');
app.route('/auth', auth);
console.log('[App] - auth routes mounted at /auth');
app.route('/auth-proxy', authProxy);
console.log('[App] - auth-proxy routes mounted at /auth-proxy');
app.route('/users', users);
console.log('[App] - users routes mounted at /users');
app.route('/logs', logs);
console.log('[App] - logs routes mounted at /logs');

// 404 handler
app.notFound((c) => {
  console.log('[App] 404 handler triggered:', c.req.method, c.req.path);
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

console.log('[App] CloudPilot API initialized successfully');

export default app;

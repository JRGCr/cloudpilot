/**
 * Authentication routes - mounts Better Auth handler
 */

import { Hono } from 'hono';
import { createAuth } from '../services/auth.js';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mount Better Auth handler for all auth routes
auth.all('/*', async (c) => {
  const authInstance = createAuth(c.env);
  return authInstance.handler(c.req.raw);
});

export { auth };

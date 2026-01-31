/**
 * Extended Hono context types
 */

import type { Logger, Session, User } from '@cloudpilot/shared';
import type { Context } from 'hono';
import type { Env } from './env.js';

export interface Variables {
  requestId: string;
  correlationId: string;
  logger: Logger;
  user?: User;
  session?: Session;
}

export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

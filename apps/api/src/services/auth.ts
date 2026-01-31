/**
 * Better Auth configuration
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../types/env.js';

export function createAuth(env: Env) {
  try {
    // Validate required environment variables
    if (!env.BETTER_AUTH_SECRET) {
      throw new Error('BETTER_AUTH_SECRET is required');
    }
    if (!env.BETTER_AUTH_URL) {
      throw new Error('BETTER_AUTH_URL is required');
    }
    if (!env.GITHUB_CLIENT_ID) {
      throw new Error('GITHUB_CLIENT_ID is required');
    }
    if (!env.GITHUB_CLIENT_SECRET) {
      throw new Error('GITHUB_CLIENT_SECRET is required');
    }

    const db = drizzle(env.DB);

    return betterAuth({
      database: drizzleAdapter(db, {
        provider: 'sqlite',
      }),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
      },
      advanced: {
        cookiePrefix: 'cloudpilot',
        useSecureCookies: env.NODE_ENV === 'production',
      },
      socialProviders: {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      },
    });
  } catch (error) {
    // Re-throw with more context
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create Better Auth instance: ${message}`);
  }
}

export type Auth = ReturnType<typeof createAuth>;

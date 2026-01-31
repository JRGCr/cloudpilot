/**
 * Better Auth configuration
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../types/env.js';

/**
 * Parses TRUSTED_ORIGINS from environment with sensible defaults
 */
function getTrustedOrigins(env: Env): string[] {
  if (env.TRUSTED_ORIGINS) {
    // Parse comma-separated list from environment
    return env.TRUSTED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  // Default origins for development and production
  const defaults = [
    'https://cloudpilot-web.pages.dev',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  // In production, be more restrictive unless explicitly configured
  if (env.NODE_ENV === 'production') {
    return ['https://cloudpilot-web.pages.dev'];
  }

  return defaults;
}

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
    const trustedOrigins = getTrustedOrigins(env);

    return betterAuth({
      database: drizzleAdapter(db, {
        provider: 'sqlite',
      }),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      trustedOrigins,
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

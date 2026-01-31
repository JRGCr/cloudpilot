/**
 * Better Auth configuration with Cloudflare Workers optimization
 */

import { betterAuth } from 'better-auth';
import { withCloudflare } from 'better-auth-cloudflare';
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
  console.log('[createAuth] Starting Better Auth creation...');
  try {
    // Validate required environment variables
    console.log('[createAuth] Validating environment variables...');
    if (!env.BETTER_AUTH_SECRET) {
      console.error('[createAuth] MISSING: BETTER_AUTH_SECRET');
      throw new Error('BETTER_AUTH_SECRET is required');
    }
    if (!env.BETTER_AUTH_URL) {
      console.error('[createAuth] MISSING: BETTER_AUTH_URL');
      throw new Error('BETTER_AUTH_URL is required');
    }
    if (!env.GITHUB_CLIENT_ID) {
      console.error('[createAuth] MISSING: GITHUB_CLIENT_ID');
      throw new Error('GITHUB_CLIENT_ID is required');
    }
    if (!env.GITHUB_CLIENT_SECRET) {
      console.error('[createAuth] MISSING: GITHUB_CLIENT_SECRET');
      throw new Error('GITHUB_CLIENT_SECRET is required');
    }
    console.log('[createAuth] All required environment variables present');

    // Log environment configuration (redacted)
    console.log('[createAuth] Configuration:', {
      baseURL: env.BETTER_AUTH_URL,
      hasSecret: !!env.BETTER_AUTH_SECRET,
      hasGitHubClientId: !!env.GITHUB_CLIENT_ID,
      hasGitHubClientSecret: !!env.GITHUB_CLIENT_SECRET,
      nodeEnv: env.NODE_ENV,
    });

    console.log('[createAuth] Creating Drizzle database instance...');
    const db = drizzle(env.DB);
    console.log('[createAuth] Drizzle instance created');

    console.log('[createAuth] Getting trusted origins...');
    const trustedOrigins = getTrustedOrigins(env);
    console.log('[createAuth] Trusted origins:', trustedOrigins);

    console.log('[createAuth] Building Better Auth configuration...');
    const authConfig = {
      // Standard Better Auth configuration
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
    };
    console.log('[createAuth] Configuration built');

    console.log('[createAuth] Applying withCloudflare wrapper...');
    const wrappedConfig = withCloudflare(
      {}, // Empty Cloudflare config - we handle database via drizzleAdapter
      authConfig,
    );
    console.log('[createAuth] Cloudflare wrapper applied');

    console.log('[createAuth] Creating betterAuth instance...');
    const authInstance = betterAuth(wrappedConfig);
    console.log('[createAuth] Better Auth instance created successfully');

    return authInstance;
  } catch (error) {
    // Re-throw with more context
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[createAuth] FATAL ERROR:', {
      message,
      stack,
      error,
    });
    throw new Error(`Failed to create Better Auth instance: ${message}`);
  }
}

export type Auth = ReturnType<typeof createAuth>;

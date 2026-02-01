/**
 * Better Auth handler for Cloudflare Pages Functions
 * Handles all /api/auth/* routes
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';

// Import schema from API package
// For now, inline the schema to avoid complex build setup
// TODO: Share schema via shared package

const users = {
  id: 'text',
  name: 'text',
  email: 'text',
  emailVerified: 'integer',
  image: 'text',
  createdAt: 'integer',
  updatedAt: 'integer',
};

const sessions = {
  id: 'text',
  userId: 'text',
  token: 'text',
  expiresAt: 'integer',
  ipAddress: 'text',
  userAgent: 'text',
  createdAt: 'integer',
  updatedAt: 'integer',
};

const accounts = {
  id: 'text',
  userId: 'text',
  accountId: 'text',
  providerId: 'text',
  accessToken: 'text',
  refreshToken: 'text',
  accessTokenExpiresAt: 'integer',
  refreshTokenExpiresAt: 'integer',
  scope: 'text',
  idToken: 'text',
  createdAt: 'integer',
  updatedAt: 'integer',
};

const verification = {
  id: 'text',
  identifier: 'text',
  value: 'text',
  expiresAt: 'integer',
  createdAt: 'integer',
  updatedAt: 'integer',
};

const schema = {
  users,
  sessions,
  accounts,
  verification,
};

interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  NODE_ENV?: string;
  TRUSTED_ORIGINS?: string;
}

function getTrustedOrigins(env: Env): string[] {
  if (env.TRUSTED_ORIGINS) {
    return env.TRUSTED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  // For Pages Functions, we're same-origin, but still specify for security
  const defaults = [
    'https://cloudpilot-web.pages.dev',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (env.NODE_ENV === 'production') {
    return ['https://cloudpilot-web.pages.dev'];
  }

  return defaults;
}

function createAuth(env: Env) {
  console.log('[Pages Auth] Creating Better Auth instance...');

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

  console.log('[Pages Auth] Environment validated');

  const db = drizzle(env.DB, { schema });
  const trustedOrigins = getTrustedOrigins(env);

  console.log('[Pages Auth] Configuration:', {
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins,
    nodeEnv: env.NODE_ENV,
  });

  const authInstance = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
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

  console.log('[Pages Auth] Better Auth instance created successfully');
  return authInstance;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  console.log('[Pages Auth] Request received:', request.method, pathname);
  console.log('[Pages Auth] Request headers:', {
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    cookie: request.headers.get('cookie') ? 'present' : 'absent',
    userAgent: request.headers.get('user-agent'),
  });

  // Enhanced logging for error routes
  if (pathname.includes('/error')) {
    console.error('[Pages Auth] ⚠️ ERROR ROUTE ACCESSED:', pathname);
    console.error('[Pages Auth] Error route query params:', url.search);
    console.error('[Pages Auth] Error route full URL:', url.toString());

    // Parse query params to show error details
    const errorType = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    const state = url.searchParams.get('state');

    console.error('[Pages Auth] Error details:', {
      errorType,
      errorDescription,
      state: state ? `${state.substring(0, 20)}...` : 'none',
      allParams: Object.fromEntries(url.searchParams.entries()),
    });
  }

  try {
    console.log('[Pages Auth] Creating auth instance...');
    let authInstance: ReturnType<typeof createAuth>;
    try {
      authInstance = createAuth(env);
      console.log('[Pages Auth] Auth instance created successfully');
    } catch (createError) {
      console.error('[Pages Auth] Failed to create auth instance:', createError);
      console.error('[Pages Auth] CreateAuth error details:', {
        name: createError instanceof Error ? createError.name : 'unknown',
        message: createError instanceof Error ? createError.message : String(createError),
        stack: createError instanceof Error ? createError.stack : 'no stack',
      });
      throw createError; // Re-throw to be caught by outer catch
    }

    console.log('[Pages Auth] Calling auth handler...');
    const response = await authInstance.handler(request);

    console.log('[Pages Auth] Handler returned, status:', response.status);

    // Log response details for debugging
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log('[Pages Auth] Setting cookie:', `${setCookie.substring(0, 100)}...`);
    }

    // Log errors
    if (response.status >= 400) {
      const cloned = response.clone();
      const text = await cloned.text();
      console.error('[Pages Auth] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: text.substring(0, 500),
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      });
    }

    // Additional logging for error route responses
    if (pathname.includes('/error')) {
      const cloned = response.clone();
      const text = await cloned.text();
      console.error('[Pages Auth] Error route response body:', text.substring(0, 1000));
    }

    return response;
  } catch (error) {
    console.error('[Pages Auth] ❌ EXCEPTION CAUGHT:', error);
    console.error('[Pages Auth] Exception details:', {
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.substring(0, 1000) : 'no stack trace',
      type: typeof error,
    });

    const errorResponse = {
      success: false,
      error: 'Authentication error',
      message: error instanceof Error ? error.message : 'Unknown error',
      path: pathname,
      timestamp: new Date().toISOString(),
    };

    console.error('[Pages Auth] Returning error response:', errorResponse);

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
};

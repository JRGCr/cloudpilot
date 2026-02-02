/**
 * CloudPilot Auth Worker
 * Handles all authentication via Better Auth
 * Comprehensive observability logging included
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Database schema for Better Auth
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

const schema = { users, sessions, accounts, verification };

function getTrustedOrigins(env) {
  if (env.TRUSTED_ORIGINS) {
    return env.TRUSTED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

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

function createAuth(env) {
  console.log('[CF-AUTH-WORKER] Creating Better Auth instance...');

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

  console.log('[CF-AUTH-WORKER] Environment validated');
  console.log('[CF-AUTH-WORKER] Config:', {
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    NODE_ENV: env.NODE_ENV,
    hasGithubId: !!env.GITHUB_CLIENT_ID,
    hasGithubSecret: !!env.GITHUB_CLIENT_SECRET,
    hasAuthSecret: !!env.BETTER_AUTH_SECRET,
    hasDB: !!env.DB,
  });

  try {
    console.log('[CF-AUTH-WORKER] Creating drizzle instance...');
    const db = drizzle(env.DB, { schema });
    console.log('[CF-AUTH-WORKER] Drizzle instance created successfully');

    const trustedOrigins = getTrustedOrigins(env);
    console.log('[CF-AUTH-WORKER] Trusted origins:', trustedOrigins);

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

    console.log('[CF-AUTH-WORKER] Better Auth instance created successfully');
    return authInstance;
  } catch (dbError) {
    console.error('[CF-AUTH-WORKER] Database/Auth setup error:', dbError);
    console.error('[CF-AUTH-WORKER] DB error details:', {
      name: dbError instanceof Error ? dbError.name : 'unknown',
      message: dbError instanceof Error ? dbError.message : String(dbError),
      stack: dbError instanceof Error ? dbError.stack : 'no stack',
    });
    throw dbError;
  }
}

// Create Hono app for routing
const app = new Hono();

// Enable CORS for web app
app.use('/*', cors({
  origin: (origin, c) => {
    const trustedOrigins = getTrustedOrigins(c.env);
    console.log('[CF-AUTH-WORKER] CORS check - Origin:', origin, 'Trusted:', trustedOrigins);
    
    // Allow requests without origin (server-to-server)
    if (!origin) return null;
    
    // Check if origin is trusted
    if (trustedOrigins.includes(origin)) {
      return origin;
    }
    
    console.warn('[CF-AUTH-WORKER] CORS blocked origin:', origin);
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Health check endpoint
app.get('/health', (c) => {
  console.log('[CF-AUTH-WORKER] Health check');
  return c.json({
    status: 'healthy',
    service: 'cloudpilot-auth',
    timestamp: new Date().toISOString(),
    environment: c.env.NODE_ENV || 'development',
  });
});

// Auth endpoints - handle all /auth/* routes
app.all('/*', async (c) => {
  const start = Date.now();
  const correlationId = Math.random().toString(36).substring(2, 15);
  const pathname = new URL(c.req.url).pathname;

  console.log('[CF-AUTH-WORKER] Request received:', c.req.method, pathname);
  console.log('[CF-AUTH-WORKER] Request headers:', {
    origin: c.req.header('origin'),
    referer: c.req.header('referer'),
    cookie: c.req.header('cookie') ? 'present' : 'absent',
    userAgent: c.req.header('user-agent'),
  });

  // Enhanced logging for observability
  console.log(`[CF-WORKER] ${JSON.stringify({
    id: correlationId,
    timestamp: new Date().toISOString(),
    level: 'info',
    source: 'worker',
    message: `Auth Worker: ${c.req.method} ${pathname}`,
    correlationId,
    cf: c.req.raw.cf || {},
    worker: {
      name: 'cloudpilot-auth',
      environment: c.env.NODE_ENV || 'development',
    },
    request: {
      method: c.req.method,
      url: c.req.url,
      path: pathname,
      userAgent: c.req.header('user-agent'),
      ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
    },
    metadata: {
      auth: {
        step: 'request_received',
        pathname,
        query: new URL(c.req.url).search,
        hasAuthorizationHeader: !!c.req.header('authorization'),
        hasCookieHeader: !!c.req.header('cookie'),
        origin: c.req.header('origin'),
        referer: c.req.header('referer'),
      }
    }
  })}`);

  // Log error routes specially
  if (pathname.includes('/error')) {
    const url = new URL(c.req.url);
    console.error('[CF-AUTH-WORKER] ⚠️ ERROR ROUTE ACCESSED:', pathname);
    console.error('[CF-AUTH-WORKER] Error route query params:', url.search);
    console.error('[CF-AUTH-WORKER] Error route full URL:', url.toString());

    const errorType = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    const state = url.searchParams.get('state');

    console.error('[CF-AUTH-WORKER] Error details:', {
      errorType,
      errorDescription,
      state: state ? `${state.substring(0, 20)}...` : 'none',
      allParams: Object.fromEntries(url.searchParams.entries()),
    });
  }

  try {
    console.log('[CF-AUTH-WORKER] Creating auth instance...');
    const authInstance = createAuth(c.env);
    console.log('[CF-AUTH-WORKER] Auth instance created successfully');

    console.log('[CF-AUTH-WORKER] Calling auth handler...');
    const response = await authInstance.handler(c.req.raw);
    console.log('[CF-AUTH-WORKER] Handler returned successfully, status:', response.status);

    // Log response details
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log('[CF-AUTH-WORKER] Setting cookie:', `${setCookie.substring(0, 100)}...`);
    }

    // Log errors
    if (response.status >= 400) {
      const cloned = response.clone();
      const text = await cloned.text();
      console.error('[CF-AUTH-WORKER] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: text.substring(0, 500),
        contentType: response.headers.get('content-type'),
      });
    }

    // Log successful response
    const duration = Date.now() - start;
    console.log(`[CF-WORKER] ${JSON.stringify({
      id: correlationId,
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'worker',
      message: `Auth Worker Response: ${response.status}`,
      correlationId,
      worker: {
        name: 'cloudpilot-auth',
        environment: c.env.NODE_ENV || 'development',
      },
      response: {
        status: response.status,
      },
      timing: {
        duration,
        slow: duration > 1000,
        verySlow: duration > 5000
      },
      metadata: {
        auth: {
          step: 'request_completed',
          success: response.status < 400
        }
      }
    })}`);

    return response;
  } catch (error) {
    console.error('[CF-AUTH-WORKER] ❌ EXCEPTION CAUGHT:', error);
    console.error('[CF-AUTH-WORKER] Exception details:', {
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
      correlationId,
    };

    console.error('[CF-AUTH-WORKER] Returning error response:', errorResponse);

    const duration = Date.now() - start;
    console.log(`[CF-WORKER] ${JSON.stringify({
      id: correlationId,
      timestamp: new Date().toISOString(),
      level: 'error',
      source: 'worker',
      message: 'Auth Worker Error Response: 500',
      correlationId,
      worker: {
        name: 'cloudpilot-auth',
        environment: c.env.NODE_ENV || 'development',
      },
      response: {
        status: 500,
      },
      timing: {
        duration,
      },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      },
      metadata: {
        auth: {
          step: 'error_response_sent',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }
      }
    })}`);

    return c.json(errorResponse, 500);
  }
});

// Export Worker
export default {
  fetch: app.fetch,
};
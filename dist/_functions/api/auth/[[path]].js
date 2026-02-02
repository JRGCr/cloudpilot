/**
 * Better Auth handler for Cloudflare Pages Functions
 * Handles all /api/auth/* routes with comprehensive observability
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';

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
  console.log('[CF-AUTH] Creating Better Auth instance...');

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

  console.log('[CF-AUTH] Environment validated');
  console.log('[CF-AUTH] Config:', {
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    NODE_ENV: env.NODE_ENV,
    hasGithubId: !!env.GITHUB_CLIENT_ID,
    hasGithubSecret: !!env.GITHUB_CLIENT_SECRET,
    hasAuthSecret: !!env.BETTER_AUTH_SECRET,
  });

  try {
    console.log('[CF-AUTH] Creating drizzle instance...');
    const db = drizzle(env.DB, { schema });
    console.log('[CF-AUTH] Drizzle instance created successfully');

    const trustedOrigins = getTrustedOrigins(env);
    console.log('[CF-AUTH] Trusted origins:', trustedOrigins);

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

    console.log('[CF-AUTH] Better Auth instance created successfully');
    return authInstance;
  } catch (dbError) {
    console.error('[CF-AUTH] Database/Auth setup error:', dbError);
    console.error('[CF-AUTH] DB error details:', {
      name: dbError instanceof Error ? dbError.name : 'unknown',
      message: dbError instanceof Error ? dbError.message : String(dbError),
      stack: dbError instanceof Error ? dbError.stack : 'no stack',
    });
    throw dbError;
  }
}

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const start = Date.now();
  const correlationId = Math.random().toString(36).substring(2, 15);

  console.log('[CF-AUTH] Request received:', request.method, pathname);
  console.log('[CF-AUTH] Request headers:', {
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    cookie: request.headers.get('cookie') ? 'present' : 'absent',
    userAgent: request.headers.get('user-agent'),
  });

  // Enhanced logging for observability system
  console.log(`[CF-PAGES] ${JSON.stringify({
    id: correlationId,
    timestamp: new Date().toISOString(),
    level: 'info',
    source: 'pages',
    message: `Auth Function: ${request.method} ${pathname}`,
    correlationId,
    cf: request.cf || {},
    pages: {
      environment: env.NODE_ENV === 'production' ? 'production' : 'preview',
      functionName: 'auth-handler'
    },
    request: {
      method: request.method,
      url: request.url,
      path: pathname,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for'),
    },
    metadata: {
      auth: {
        step: 'request_received',
        pathname,
        query: url.search,
        hasAuthorizationHeader: !!request.headers.get('authorization'),
        hasCookieHeader: !!request.headers.get('cookie'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      }
    }
  })}`);

  // Enhanced logging for error routes
  if (pathname.includes('/error')) {
    console.error('[CF-AUTH] ⚠️ ERROR ROUTE ACCESSED:', pathname);
    console.error('[CF-AUTH] Error route query params:', url.search);
    console.error('[CF-AUTH] Error route full URL:', url.toString());

    const errorType = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    const state = url.searchParams.get('state');

    console.error('[CF-AUTH] Error details:', {
      errorType,
      errorDescription,
      state: state ? `${state.substring(0, 20)}...` : 'none',
      allParams: Object.fromEntries(url.searchParams.entries()),
    });
  }

  try {
    console.log('[CF-AUTH] Creating auth instance...');
    let authInstance;
    try {
      authInstance = createAuth(env);
      console.log('[CF-AUTH] Auth instance created successfully');
    } catch (createError) {
      console.error('[CF-AUTH] Failed to create auth instance:', createError);
      console.error('[CF-AUTH] CreateAuth error details:', {
        name: createError instanceof Error ? createError.name : 'unknown',
        message: createError instanceof Error ? createError.message : String(createError),
        stack: createError instanceof Error ? createError.stack : 'no stack',
      });
      throw createError;
    }

    console.log('[CF-AUTH] Calling auth handler...');
    console.log('[CF-AUTH] Request details:', {
      method: request.method,
      url: pathname,
      hasBody: request.method !== 'GET',
      contentType: request.headers.get('content-type'),
    });

    let response;
    try {
      response = await authInstance.handler(request);
      console.log('[CF-AUTH] Handler returned successfully, status:', response.status);
    } catch (handlerError) {
      console.error('[CF-AUTH] Handler execution failed:', handlerError);
      console.error('[CF-AUTH] Handler error details:', {
        name: handlerError instanceof Error ? handlerError.name : 'unknown',
        message: handlerError instanceof Error ? handlerError.message : String(handlerError),
        stack: handlerError instanceof Error ? handlerError.stack?.substring(0, 1000) : 'no stack',
      });
      throw handlerError;
    }

    // Log response details for debugging
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log('[CF-AUTH] Setting cookie:', `${setCookie.substring(0, 100)}...`);
    }

    // Log errors
    if (response.status >= 400) {
      const cloned = response.clone();
      const text = await cloned.text();
      console.error('[CF-AUTH] Error response:', {
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
      console.error('[CF-AUTH] Error route response body:', text.substring(0, 1000));
    }

    // Log successful response
    const duration = Date.now() - start;
    console.log(`[CF-PAGES] ${JSON.stringify({
      id: correlationId,
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'pages',
      message: `Auth Function Response: ${response.status}`,
      correlationId,
      pages: {
        environment: env.NODE_ENV === 'production' ? 'production' : 'preview',
        functionName: 'auth-handler'
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
    console.error('[CF-AUTH] ❌ EXCEPTION CAUGHT:', error);
    console.error('[CF-AUTH] Exception details:', {
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

    console.error('[CF-AUTH] Returning error response:', errorResponse);

    const response = new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });

    // Log error response
    const duration = Date.now() - start;
    console.log(`[CF-PAGES] ${JSON.stringify({
      id: correlationId,
      timestamp: new Date().toISOString(),
      level: 'error',
      source: 'pages',
      message: 'Auth Function Error Response: 500',
      correlationId,
      pages: {
        environment: env.NODE_ENV === 'production' ? 'production' : 'preview',
        functionName: 'auth-handler'
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

    return response;
  }
};
/**
 * Simple Better Auth handler for Cloudflare Pages Functions
 * Handles all /api/auth/* routes
 */

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const start = Date.now();
  const correlationId = Math.random().toString(36).substring(2, 15);

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
        step: 'auth_function_reached',
        pathname,
        query: url.search,
        hasAuthorizationHeader: !!request.headers.get('authorization'),
        hasCookieHeader: !!request.headers.get('cookie'),
      }
    }
  })}`);

  // For now, return a simple response to verify the function is working
  const responseData = {
    message: 'Auth function is working',
    path: pathname,
    method: request.method,
    timestamp: new Date().toISOString(),
    correlationId,
    environment: env.NODE_ENV || 'development',
    hasDatabase: !!env.DB,
    hasAuthSecret: !!env.BETTER_AUTH_SECRET,
    hasGithubCredentials: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  };

  const response = new Response(JSON.stringify(responseData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

  // Log successful response
  const duration = Date.now() - start;
  console.log(`[CF-PAGES] ${JSON.stringify({
    id: correlationId,
    timestamp: new Date().toISOString(),
    level: 'info',
    source: 'pages',
    message: `Auth Function Response: ${response.status}`,
    correlationId,
    timing: { duration },
    metadata: { auth: { step: 'response_sent', success: true } }
  })}`);

  return response;
};
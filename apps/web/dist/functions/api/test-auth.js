/**
 * Simple test function to verify auth path routing
 */

export const onRequest = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  
  console.log('[Test Auth] Request received:', request.method, url.pathname);
  
  return new Response(JSON.stringify({
    message: 'Auth test endpoint working',
    path: url.pathname,
    method: request.method,
    timestamp: new Date().toISOString(),
    success: true
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
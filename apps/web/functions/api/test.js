/**
 * Simple test Pages Function to verify deployment
 */

export async function onRequest(context) {
  return new Response(JSON.stringify({
    message: 'Pages Function is working!',
    timestamp: new Date().toISOString(),
    path: new URL(context.request.url).pathname
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
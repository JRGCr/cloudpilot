/**
 * Cloudflare Pages catch-all function
 * Handles SPA routing and static file serving
 *
 * For React SPA with client-side routing:
 * - Static assets (JS, CSS, images) are served as-is
 * - All other routes serve index.html for client-side routing
 * - API routes return 404 (handled by separate API worker)
 */

interface PagesContext {
  request: Request;
  next: (request?: Request) => Promise<Response>;
}

/**
 * Check if the path is a static asset
 */
function isAsset(pathname: string): boolean {
  // Check for file extensions that indicate static assets
  const assetExtensions = [
    '.js',
    '.css',
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.webp',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];

  return assetExtensions.some((ext) => pathname.endsWith(ext));
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const { pathname } = url;

  // API routes should 404 - they're handled by the separate API worker
  if (pathname.startsWith('/api')) {
    return new Response('Not Found', { status: 404 });
  }

  // Let static assets be served directly by Pages
  if (isAsset(pathname)) {
    return context.next();
  }

  // Serve index.html directly if it's explicitly requested
  if (pathname === '/index.html') {
    return context.next();
  }

  // For all other routes (/, /dashboard, /logs, etc.), serve index.html
  // This allows React Router to handle client-side routing
  const indexUrl = new URL(context.request.url);
  indexUrl.pathname = '/index.html';

  const indexRequest = new Request(indexUrl, context.request);
  const response = await context.next(indexRequest);

  // Add SPA-specific headers
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-cache'); // Don't cache HTML

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

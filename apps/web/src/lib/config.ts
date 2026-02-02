/**
 * App configuration
 */

export const config = {
  // Auth is now served via dedicated Worker
  // API endpoints still use relative URL for other services
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  authUrl: import.meta.env.VITE_AUTH_URL || 'https://cloudpilot-auth.blackbaysolutions.workers.dev',
} as const;

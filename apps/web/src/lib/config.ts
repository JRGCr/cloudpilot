/**
 * App configuration
 */

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'https://cloudpilot-api.blackbaysolutions.workers.dev',
} as const;

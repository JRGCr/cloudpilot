/**
 * App configuration
 */

export const config = {
  // API is now served via Pages Functions on same origin
  // Use relative URL to avoid CORS and enable cookie sharing
  apiUrl: import.meta.env.VITE_API_URL || '/api',
} as const;

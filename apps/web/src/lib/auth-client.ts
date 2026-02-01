/**
 * Better Auth client configuration
 */

import { createAuthClient } from 'better-auth/react';
import { config } from './config';

console.log('[Auth Client] Initializing Better Auth client');

// Better Auth client requires absolute URL
// Since API is now on same origin (Pages Functions), construct from window.location
const getAuthBaseURL = () => {
  // For SSR or build time, use relative path (will be resolved at runtime)
  if (typeof window === 'undefined') {
    return config.apiUrl.startsWith('http')
      ? `${config.apiUrl}/auth`
      : 'http://localhost:5173/api/auth'; // Fallback for SSR
  }

  // At runtime, construct absolute URL from current origin
  const baseURL = config.apiUrl.startsWith('http')
    ? config.apiUrl // Already absolute (e.g., http://localhost:8787)
    : `${window.location.origin}${config.apiUrl}`; // Make relative URL absolute

  const authURL = `${baseURL}/auth`;
  console.log('[Auth Client] Using baseURL:', authURL);
  return authURL;
};

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});

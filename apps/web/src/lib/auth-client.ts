/**
 * Better Auth client configuration
 */

import { createAuthClient } from 'better-auth/react';
import { config } from './config';

console.log('[Auth Client] Initializing Better Auth client');

// Better Auth client requires absolute URL
// Auth is now served via dedicated Worker
const getAuthBaseURL = () => {
  // Use the dedicated auth Worker URL
  const authURL = config.authUrl;
  console.log('[Auth Client] Using baseURL:', authURL);
  return authURL;
};

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});

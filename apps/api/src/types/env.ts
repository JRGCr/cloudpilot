/**
 * Cloudflare Workers environment bindings
 */

export interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  AUTH_PROXY_SECRET?: string;
  TRUSTED_ORIGINS?: string;
}

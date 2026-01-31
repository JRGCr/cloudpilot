/**
 * Cloudflare Workers environment bindings
 */

export interface Env {
  DB: D1Database;
  AUTH_TRANSFER_TOKENS: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  AUTH_PROXY_SECRET?: string;
}

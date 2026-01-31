/**
 * Auth proxy routes for preview environment OAuth
 *
 * Solves the problem of GitHub OAuth requiring pre-registered callback URLs
 * while preview environments have dynamic URLs.
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Variables } from '../types/context.js';
import type { Env } from '../types/env.js';
import { isAllowedReturnUrl, signState, verifyState } from './auth-proxy.utils.js';

const authProxy = new Hono<{ Bindings: Env; Variables: Variables }>();

// Initiate OAuth flow for preview environment
authProxy.get('/init', async (c) => {
  const returnUrl = c.req.query('return_url');
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  if (!returnUrl || !isAllowedReturnUrl(returnUrl)) {
    logger?.warn('Invalid return URL in auth proxy init', { requestId, returnUrl });
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid return URL. Must be from allowed domains.',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      400,
    );
  }

  // Redact full URL from logs for security
  logger?.authEvent('auth_proxy_init', undefined, {
    returnUrlDomain: new URL(returnUrl).hostname,
    requestId,
  });

  const secret = c.env.AUTH_PROXY_SECRET ?? c.env.BETTER_AUTH_SECRET;
  const state = await signState(returnUrl, secret);

  // Build GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', `${c.env.BETTER_AUTH_URL}/auth-proxy/callback`);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', state);

  return c.redirect(githubAuthUrl.toString());
});

// Handle GitHub callback
authProxy.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  if (!code || !state) {
    logger?.warn('Missing code or state in auth callback', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      400,
    );
  }

  const secret = c.env.AUTH_PROXY_SECRET ?? c.env.BETTER_AUTH_SECRET;
  const returnUrl = await verifyState(state, secret);

  if (!returnUrl) {
    logger?.warn('Invalid state parameter in auth callback', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid state parameter',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  // Redact full URL and code from logs
  logger?.authEvent('auth_proxy_callback', undefined, {
    returnUrlDomain: new URL(returnUrl).hostname,
    requestId,
  });

  // Create transfer token with the OAuth code
  const transferToken = nanoid(32);
  const expiresAt = Date.now() + 60000; // 60 seconds

  // Store in D1 database
  await c.env.DB.prepare(
    'INSERT INTO transfer_tokens (id, return_url, code, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(transferToken, returnUrl, code, expiresAt)
    .run();

  // Redirect to preview with transfer token
  const redirectUrl = new URL(returnUrl);
  redirectUrl.searchParams.set('transfer_token', transferToken);

  return c.redirect(redirectUrl.toString());
});

// Exchange transfer token for session
authProxy.post('/exchange', async (c) => {
  const body = await c.req.json<{ transferToken: string }>();
  const { transferToken } = body;
  const logger = c.get('logger');
  const requestId = c.get('requestId');

  // Get token data from D1
  const result = await c.env.DB.prepare(
    'SELECT return_url, code, expires_at FROM transfer_tokens WHERE id = ?',
  )
    .bind(transferToken)
    .first();

  if (!result) {
    logger?.warn('Invalid or expired transfer token', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired transfer token',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  const tokenData = {
    returnUrl: result.return_url as string,
    code: result.code as string,
    expiresAt: result.expires_at as number,
  };

  // Check expiration
  if (tokenData.expiresAt < Date.now()) {
    await c.env.DB.prepare('DELETE FROM transfer_tokens WHERE id = ?').bind(transferToken).run();
    logger?.warn('Expired transfer token', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Transfer token expired',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  // Delete token from D1 (single use)
  await c.env.DB.prepare('DELETE FROM transfer_tokens WHERE id = ?').bind(transferToken).run();

  if (!tokenData.code) {
    logger?.warn('No OAuth code in transfer token', { requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No OAuth code in transfer token',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  // Exchange code for access token with GitHub
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code: tokenData.code,
    }),
  });

  const tokens = (await tokenResponse.json()) as { access_token?: string; error?: string };

  if (tokens.error || !tokens.access_token) {
    // Don't log the actual error as it might contain sensitive info
    logger?.authEvent('auth_proxy_error', undefined, { hasError: true, requestId });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Failed to exchange code for token',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      401,
    );
  }

  logger?.authEvent('auth_proxy_exchange', undefined, { requestId });

  // Return success - the client should then use this to create a session
  // Note: Access token is intentionally returned here as it's needed by the client
  // to complete the auth flow. The client should use it immediately and not store it.
  return c.json({
    success: true,
    data: {
      accessToken: tokens.access_token,
    },
    meta: { requestId, timestamp: new Date().toISOString() },
  });
});

export { authProxy };

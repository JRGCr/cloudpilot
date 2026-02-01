/**
 * Current user endpoint for Cloudflare Pages Functions
 * Handles GET /api/users/me, PATCH /api/users/me, DELETE /api/users/me
 */

import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

interface DbUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

function toUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    emailVerified: dbUser.emailVerified === 1,
    image: dbUser.image,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };
}

async function getUserFromSession(db: D1Database, request: Request): Promise<User | null> {
  console.log('[Pages Users] Extracting session from request');

  // Extract session token from cookie
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    console.log('[Pages Users] No cookie header found');
    return null;
  }

  // Look for cloudpilot_session cookie
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith('cloudpilot_session='));

  if (!sessionCookie) {
    console.log('[Pages Users] No session cookie found');
    return null;
  }

  const sessionToken = sessionCookie.split('=')[1];
  console.log('[Pages Users] Session token found:', `${sessionToken.substring(0, 20)}...`);

  // Query session and user
  try {
    const result = await db
      .prepare(`
        SELECT u.*
        FROM users u
        INNER JOIN sessions s ON u.id = s.userId
        WHERE s.token = ? AND s.expiresAt > ?
      `)
      .bind(sessionToken, Date.now())
      .first<DbUser>();

    if (!result) {
      console.log('[Pages Users] Session not found or expired');
      return null;
    }

    console.log('[Pages Users] User authenticated:', result.id);
    return toUser(result);
  } catch (error) {
    console.error('[Pages Users] Error querying session:', error);
    return null;
  }
}

// GET /api/users/me
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  console.log('[Pages Users] GET /api/users/me');

  const user = await getUserFromSession(env.DB, request);

  if (!user) {
    console.log('[Pages Users] Unauthenticated request');
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  console.log('[Pages Users] Returning user profile');

  return new Response(
    JSON.stringify({
      success: true,
      data: user,
      meta: { timestamp: new Date().toISOString() },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};

// PATCH /api/users/me
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  console.log('[Pages Users] PATCH /api/users/me');

  const user = await getUserFromSession(env.DB, request);

  if (!user) {
    console.log('[Pages Users] Unauthenticated request');
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const updates = await request.json<{ name?: string; image?: string }>();
    console.log('[Pages Users] Update request:', { fields: Object.keys(updates) });

    const updateFields: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.image !== undefined) {
      updateFields.push('image = ?');
      params.push(updates.image);
    }

    if (updateFields.length === 0) {
      console.log('[Pages Users] No fields to update, returning current user');
      return new Response(
        JSON.stringify({
          success: true,
          data: user,
          meta: { timestamp: new Date().toISOString() },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    updateFields.push('updatedAt = ?');
    params.push(new Date().toISOString());
    params.push(user.id);

    console.log('[Pages Users] Executing update query');
    await env.DB.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // Fetch updated user
    const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(user.id)
      .first<DbUser>();

    if (!updatedUser) {
      console.error('[Pages Users] User disappeared after update');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
          },
          meta: { timestamp: new Date().toISOString() },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('[Pages Users] User updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: toUser(updatedUser),
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[Pages Users] Error updating user:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user',
        },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};

// DELETE /api/users/me
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  console.log('[Pages Users] DELETE /api/users/me');

  const user = await getUserFromSession(env.DB, request);

  if (!user) {
    console.log('[Pages Users] Unauthenticated request');
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    console.log('[Pages Users] Deleting user account:', user.id);

    const result = await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

    if (result.meta.changes === 0) {
      console.log('[Pages Users] User not found during deletion');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
          },
          meta: { timestamp: new Date().toISOString() },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('[Pages Users] User account deleted successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: { deleted: true },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[Pages Users] Error deleting user:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user',
        },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};

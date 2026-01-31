/**
 * User service - handles user-related operations
 */

import { type Logger, type Result, type User, err, isOk, ok } from '@cloudpilot/shared';
import { execute, queryFirst } from '../db/client.js';

interface DbUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number;
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

export async function getUser(
  db: D1Database,
  id: string,
  logger?: Logger,
): Promise<Result<User, Error>> {
  const result = await queryFirst<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [id], logger);

  if (!isOk(result)) return result;
  if (!result.value) return err(new Error('User not found'));

  return ok(toUser(result.value));
}

export async function updateUser(
  db: D1Database,
  id: string,
  data: { name?: string; image?: string },
  logger?: Logger,
): Promise<Result<User, Error>> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.image !== undefined) {
    updates.push('image = ?');
    params.push(data.image);
  }

  if (updates.length === 0) {
    return getUser(db, id, logger);
  }

  updates.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(id);

  const result = await execute(
    db,
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    params,
    logger,
  );

  if (!isOk(result)) return result;

  return getUser(db, id, logger);
}

export async function deleteUser(
  db: D1Database,
  id: string,
  logger?: Logger,
): Promise<Result<void, Error>> {
  const result = await execute(db, 'DELETE FROM users WHERE id = ?', [id], logger);

  if (!isOk(result)) return result;
  if (result.value.meta.changes === 0) {
    return err(new Error('User not found'));
  }

  return ok(undefined);
}

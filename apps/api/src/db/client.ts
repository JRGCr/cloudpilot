/**
 * Database client utilities for D1
 */

import { type Logger, type Result, tryCatchAsync } from '@cloudpilot/shared';

export type QueryResult<T> = Result<T[], Error>;
export type SingleResult<T> = Result<T | null, Error>;

export async function query<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  logger?: Logger,
): Promise<QueryResult<T>> {
  const start = Date.now();

  const result = await tryCatchAsync(async () => {
    const stmt = db.prepare(sql).bind(...params);
    const response = await stmt.all<T>();
    return response.results;
  });

  if (logger) {
    const rowCount = result._tag === 'Ok' ? result.value.length : 0;
    logger.dbQuery(sql, params.length, Date.now() - start, rowCount);
  }

  return result;
}

export async function queryFirst<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  logger?: Logger,
): Promise<SingleResult<T>> {
  const start = Date.now();

  const result = await tryCatchAsync(async () => {
    const stmt = db.prepare(sql).bind(...params);
    return stmt.first<T>();
  });

  if (logger) {
    const rowCount = result._tag === 'Ok' && result.value ? 1 : 0;
    logger.dbQuery(sql, params.length, Date.now() - start, rowCount);
  }

  return result;
}

export async function execute(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  logger?: Logger,
): Promise<Result<D1Result, Error>> {
  const start = Date.now();

  const result = await tryCatchAsync(async () => {
    const stmt = db.prepare(sql).bind(...params);
    return stmt.run();
  });

  if (logger) {
    const rowsAffected = result._tag === 'Ok' ? (result.value.meta.changes ?? 0) : 0;
    logger.dbQuery(sql, params.length, Date.now() - start, rowsAffected);
  }

  return result;
}

export async function transaction<T>(
  db: D1Database,
  fn: (db: D1Database) => Promise<T>,
  logger?: Logger,
): Promise<Result<T, Error>> {
  // D1 doesn't support true transactions yet
  // This is a placeholder for when it does
  logger?.debug('Starting transaction');
  const result = await tryCatchAsync(() => fn(db));
  logger?.debug('Transaction complete', { success: result._tag === 'Ok' });
  return result;
}

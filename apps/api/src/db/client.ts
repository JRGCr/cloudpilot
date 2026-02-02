/**
 * Enhanced database client utilities for D1 with comprehensive logging
 */

import { type Logger, type Result, tryCatchAsync, FileWriter, createLogger } from '@cloudpilot/shared';
import { createD1Logger, type CloudflareLogger } from '@cloudpilot/shared/logging/cloudflare-logger';
import path from 'node:path';

export type QueryResult<T> = Result<T[], Error>;
export type SingleResult<T> = Result<T | null, Error>;

// Create dedicated database logger
function createDatabaseLogger(correlationId?: string): Logger {
  return createLogger({
    source: 'database',
    writers: [
      new FileWriter({ filePath: path.join(process.cwd(), 'logs', 'database.log') }),
    ],
    defaultMetadata: correlationId ? { correlationId } : {},
  });
}

export async function query<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  logger?: Logger,
  cfLogger?: CloudflareLogger,
): Promise<QueryResult<T>> {
  const start = Date.now();
  const dbLogger = createDatabaseLogger(logger?.defaultMetadata?.correlationId as string);
  const d1Logger = cfLogger || createD1Logger('cloudpilot', logger?.defaultMetadata?.correlationId as string);
  const queryId = Math.random().toString(36).substring(2, 15);

  // Log query start with sanitized parameters
  const sanitizedParams = params.map(param => 
    typeof param === 'string' && param.length > 100 ? 
      `${param.substring(0, 100)}...` : param
  );

  dbLogger.info('Database query started', {
    database: {
      queryId,
      operation: sql.trim().split(/\s+/)[0].toUpperCase(), // GET, POST, UPDATE, etc.
      sql: sql.length > 500 ? `${sql.substring(0, 500)}...` : sql,
      paramCount: params.length,
      parameters: sanitizedParams,
      status: 'started',
    },
  });

  const result = await d1Logger.trackD1Operation('query', async () => {
    const stmt = db.prepare(sql).bind(...params);
    const response = await stmt.all<T>();
    
    // Log the D1 query with comprehensive details
    d1Logger.d1Query(
      'cloudpilot',
      'query', 
      sql, 
      params, 
      { results: response.results, changes: 0 }, 
      Date.now() - start
    );
    
    return response.results;
  });

  const duration = Date.now() - start;
  const success = result._tag === 'Ok';
  const rowCount = success ? result.value.length : 0;

  // Log query completion
  if (success) {
    dbLogger.info('Database query completed', {
      database: {
        queryId,
        operation: sql.trim().split(/\s+/)[0].toUpperCase(),
        status: 'completed',
        rowsReturned: rowCount,
        duration,
        performance: {
          slow: duration > 100,
          veryslow: duration > 1000,
        },
      },
    });

    // Log performance warning for slow queries
    if (duration > 500) {
      dbLogger.warn('Slow database query detected', {
        database: {
          queryId,
          sql: sql.length > 200 ? `${sql.substring(0, 200)}...` : sql,
          duration,
          threshold: 500,
          slowQueryAlert: true,
        },
      });
    }
  } else {
    const error = result.error;
    dbLogger.error('Database query failed', {
      database: {
        queryId,
        operation: sql.trim().split(/\s+/)[0].toUpperCase(),
        status: 'failed',
        duration,
        error: {
          name: error.name,
          message: error.message,
        },
      },
    });
    
    // Also log error with D1 logger
    d1Logger.d1Error('cloudpilot', 'query', error, sql);
  }

  // Also log to request-scoped logger if provided
  if (logger) {
    logger.dbQuery(sql, params.length, duration, rowCount);
  }

  return result;
}

export async function queryFirst<T>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  logger?: Logger,
  cfLogger?: CloudflareLogger,
): Promise<SingleResult<T>> {
  const start = Date.now();
  const dbLogger = createDatabaseLogger(logger?.defaultMetadata?.correlationId as string);
  const d1Logger = cfLogger || createD1Logger('cloudpilot', logger?.defaultMetadata?.correlationId as string);
  const queryId = Math.random().toString(36).substring(2, 15);

  // Log query start
  const sanitizedParams = params.map(param => 
    typeof param === 'string' && param.length > 100 ? 
      `${param.substring(0, 100)}...` : param
  );

  dbLogger.info('Database queryFirst started', {
    database: {
      queryId,
      operation: sql.trim().split(/\s+/)[0].toUpperCase(),
      sql: sql.length > 500 ? `${sql.substring(0, 500)}...` : sql,
      paramCount: params.length,
      parameters: sanitizedParams,
      queryType: 'single',
      status: 'started',
    },
  });

  const result = await d1Logger.trackD1Operation('queryFirst', async () => {
    const stmt = db.prepare(sql).bind(...params);
    const response = await stmt.first<T>();
    
    // Log the D1 query with comprehensive details
    d1Logger.d1Query(
      'cloudpilot',
      'query', 
      sql, 
      params, 
      { results: response ? [response] : [], changes: 0 }, 
      Date.now() - start
    );
    
    return response;
  });

  const duration = Date.now() - start;
  const success = result._tag === 'Ok';
  const rowCount = success && result.value ? 1 : 0;

  // Log query completion
  if (success) {
    dbLogger.info('Database queryFirst completed', {
      database: {
        queryId,
        operation: sql.trim().split(/\s+/)[0].toUpperCase(),
        status: 'completed',
        queryType: 'single',
        resultFound: !!result.value,
        duration,
        performance: {
          slow: duration > 100,
          veryslow: duration > 1000,
        },
      },
    });
  } else {
    const error = result.error;
    dbLogger.error('Database queryFirst failed', {
      database: {
        queryId,
        operation: sql.trim().split(/\s+/)[0].toUpperCase(),
        status: 'failed',
        queryType: 'single',
        duration,
        error: {
          name: error.name,
          message: error.message,
        },
      },
    });
    
    // Also log error with D1 logger
    d1Logger.d1Error('cloudpilot', 'queryFirst', error, sql);
  }

  if (logger) {
    logger.dbQuery(sql, params.length, duration, rowCount);
  }

  return result;
}

export async function execute(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
  logger?: Logger,
  cfLogger?: CloudflareLogger,
): Promise<Result<D1Result, Error>> {
  const start = Date.now();
  const dbLogger = createDatabaseLogger(logger?.defaultMetadata?.correlationId as string);
  const d1Logger = cfLogger || createD1Logger('cloudpilot', logger?.defaultMetadata?.correlationId as string);
  const queryId = Math.random().toString(36).substring(2, 15);

  // Log execute start
  const sanitizedParams = params.map(param => 
    typeof param === 'string' && param.length > 100 ? 
      `${param.substring(0, 100)}...` : param
  );

  dbLogger.info('Database execute started', {
    database: {
      queryId,
      operation: sql.trim().split(/\s+/)[0].toUpperCase(),
      sql: sql.length > 500 ? `${sql.substring(0, 500)}...` : sql,
      paramCount: params.length,
      parameters: sanitizedParams,
      queryType: 'execute',
      status: 'started',
    },
  });

  const result = await d1Logger.trackD1Operation('execute', async () => {
    const stmt = db.prepare(sql).bind(...params);
    const response = await stmt.run();
    
    // Log the D1 execute with comprehensive details
    d1Logger.d1Query(
      'cloudpilot',
      'exec', 
      sql, 
      params, 
      { changes: response.meta.changes, results: [] }, 
      Date.now() - start
    );
    
    return response;
  });

  const duration = Date.now() - start;
  const success = result._tag === 'Ok';
  const rowsAffected = success ? (result.value.meta.changes ?? 0) : 0;

  // Log execute completion
  if (success) {
    dbLogger.info('Database execute completed', {
      database: {
        queryId,
        operation: sql.trim().split(/\s+/)[0].toUpperCase(),
        status: 'completed',
        queryType: 'execute',
        rowsAffected,
        lastRowId: result.value.meta.last_row_id,
        duration,
        performance: {
          slow: duration > 100,
          veryslow: duration > 1000,
        },
      },
    });

    // Log performance warning for slow executions
    if (duration > 500) {
      dbLogger.warn('Slow database execute detected', {
        database: {
          queryId,
          sql: sql.length > 200 ? `${sql.substring(0, 200)}...` : sql,
          duration,
          threshold: 500,
          slowExecuteAlert: true,
        },
      });
    }
  } else {
    const error = result.error;
    dbLogger.error('Database execute failed', {
      database: {
        queryId,
        operation: sql.trim().split(/\s+/)[0].toUpperCase(),
        status: 'failed',
        queryType: 'execute',
        duration,
        error: {
          name: error.name,
          message: error.message,
        },
      },
    });
    
    // Also log error with D1 logger
    d1Logger.d1Error('cloudpilot', 'execute', error, sql);
  }

  if (logger) {
    logger.dbQuery(sql, params.length, duration, rowsAffected);
  }

  return result;
}

export async function transaction<T>(
  db: D1Database,
  fn: (db: D1Database) => Promise<T>,
  logger?: Logger,
): Promise<Result<T, Error>> {
  const start = Date.now();
  const dbLogger = createDatabaseLogger(logger?.defaultMetadata?.correlationId as string);
  const transactionId = Math.random().toString(36).substring(2, 15);

  // D1 doesn't support true transactions yet - this is a placeholder
  dbLogger.info('Database transaction started', {
    database: {
      transactionId,
      operation: 'TRANSACTION',
      status: 'started',
      note: 'D1 placeholder - no true transaction support',
    },
  });

  const result = await tryCatchAsync(() => fn(db));
  const duration = Date.now() - start;
  const success = result._tag === 'Ok';

  if (success) {
    dbLogger.info('Database transaction completed', {
      database: {
        transactionId,
        operation: 'TRANSACTION',
        status: 'completed',
        duration,
      },
    });
  } else {
    const error = result.error;
    dbLogger.error('Database transaction failed', {
      database: {
        transactionId,
        operation: 'TRANSACTION',
        status: 'failed',
        duration,
        error: {
          name: error.name,
          message: error.message,
        },
      },
    });
  }

  if (logger) {
    logger.debug(`Transaction ${success ? 'complete' : 'failed'}`, { 
      transactionId, 
      success, 
      duration,
    });
  }

  return result;
}

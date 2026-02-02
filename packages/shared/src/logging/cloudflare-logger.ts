/**
 * Cloudflare-specific logging utilities for Pages, Workers, and D1
 */

import { nanoid } from 'nanoid';

export interface CloudflareLogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: 'pages' | 'worker' | 'd1' | 'cloudflare';
  message: string;
  correlationId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  
  // Cloudflare-specific fields
  cf?: {
    colo?: string;
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
    postalCode?: string;
    metroCode?: string;
    asn?: number;
    asOrganization?: string;
  };
  request?: {
    method: string;
    url: string;
    path: string;
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    bodySize?: number;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
    size?: number;
  };
  timing?: {
    duration: number;
    cpuTime?: number;
    wallTime?: number;
    slow?: boolean;
    verySlow?: boolean;
  };
  d1?: {
    database: string;
    operation: 'query' | 'prepare' | 'batch' | 'exec';
    sql?: string;
    params?: number;
    rowsAffected?: number;
    rowsReturned?: number;
    duration: number;
    success: boolean;
    error?: string;
  };
  worker?: {
    name: string;
    version?: string;
    invocationId?: string;
    subrequest?: boolean;
    memoryUsage?: number;
    cpuTime?: number;
  };
  pages?: {
    environment: 'production' | 'preview' | 'development';
    project?: string;
    deployment?: string;
    functionName?: string;
  };
}

export class CloudflareLogger {
  public correlationId?: string;
  public requestId?: string;
  private defaultMetadata: Record<string, unknown>;
  private cfInfo?: CloudflareLogEntry['cf'];
  private workerInfo?: CloudflareLogEntry['worker'];
  private pagesInfo?: CloudflareLogEntry['pages'];

  constructor(config: {
    correlationId?: string;
    requestId?: string;
    defaultMetadata?: Record<string, unknown>;
    cfInfo?: CloudflareLogEntry['cf'];
    workerInfo?: CloudflareLogEntry['worker'];
    pagesInfo?: CloudflareLogEntry['pages'];
  } = {}) {
    this.correlationId = config.correlationId;
    this.requestId = config.requestId;
    this.defaultMetadata = config.defaultMetadata || {};
    this.cfInfo = config.cfInfo;
    this.workerInfo = config.workerInfo;
    this.pagesInfo = config.pagesInfo;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.log('fatal', message, metadata);
  }

  // Cloudflare-specific logging methods

  pagesRequest(request: Request, metadata?: Record<string, unknown>): void {
    const url = new URL(request.url);
    this.info(`Pages Function: ${request.method} ${url.pathname}`, {
      request: {
        method: request.method,
        url: request.url,
        path: url.pathname,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('cf-connecting-ip') || 
            request.headers.get('x-forwarded-for') || undefined,
        headers: this.sanitizeHeaders(request.headers),
      },
      pages: this.pagesInfo,
      ...metadata,
    });
  }

  pagesResponse(response: Response, duration: number, metadata?: Record<string, unknown>): void {
    const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';
    this.log(level, `Pages Function Response: ${response.status}`, {
      response: {
        status: response.status,
        headers: this.sanitizeHeaders(response.headers),
      },
      timing: {
        duration,
        slow: duration > 1000,
        verySlow: duration > 5000,
      },
      pages: this.pagesInfo,
      ...metadata,
    });
  }

  pagesError(error: Error, request?: Request, metadata?: Record<string, unknown>): void {
    this.error(`Pages Function Error: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      request: request ? {
        method: request.method,
        path: new URL(request.url).pathname,
      } : undefined,
      pages: this.pagesInfo,
      ...metadata,
    });
  }

  workerInvocation(name: string, invocationId: string, metadata?: Record<string, unknown>): void {
    this.info(`Worker Invocation: ${name}`, {
      worker: {
        ...this.workerInfo,
        name,
        invocationId,
      },
      ...metadata,
    });
  }

  workerPerformance(operation: string, duration: number, cpuTime?: number, metadata?: Record<string, unknown>): void {
    const level = duration > 10000 ? 'warn' : 'debug'; // 10s threshold for workers
    this.log(level, `Worker Performance: ${operation}`, {
      timing: {
        duration,
        cpuTime,
        slow: duration > 5000,
        verySlow: duration > 10000,
      },
      worker: this.workerInfo,
      ...metadata,
    });
  }

  d1Query(database: string, operation: CloudflareLogEntry['d1']['operation'], sql: string, params: unknown[], result: any, duration: number, metadata?: Record<string, unknown>): void {
    const sanitizedSql = this.sanitizeSql(sql);
    const level = duration > 1000 ? 'warn' : 'debug';
    
    this.log(level, `D1 Query: ${operation.toUpperCase()}`, {
      d1: {
        database,
        operation,
        sql: sanitizedSql,
        params: params.length,
        rowsAffected: result?.changes || 0,
        rowsReturned: Array.isArray(result?.results) ? result.results.length : 0,
        duration,
        success: !result?.error,
        error: result?.error?.message,
      },
      timing: {
        duration,
        slow: duration > 100,
        verySlow: duration > 1000,
      },
      ...metadata,
    });
  }

  d1BatchOperation(database: string, queries: number, duration: number, results: any[], metadata?: Record<string, unknown>): void {
    const totalChanges = results.reduce((sum, r) => sum + (r?.changes || 0), 0);
    const totalRows = results.reduce((sum, r) => sum + (Array.isArray(r?.results) ? r.results.length : 0), 0);
    const errors = results.filter(r => r?.error).length;

    const level = errors > 0 ? 'error' : duration > 2000 ? 'warn' : 'info';

    this.log(level, `D1 Batch Operation: ${queries} queries`, {
      d1: {
        database,
        operation: 'batch',
        params: queries,
        rowsAffected: totalChanges,
        rowsReturned: totalRows,
        duration,
        success: errors === 0,
        error: errors > 0 ? `${errors} queries failed` : undefined,
      },
      timing: {
        duration,
        slow: duration > 1000,
        verySlow: duration > 2000,
      },
      batch: {
        queries,
        errors,
        successRate: ((queries - errors) / queries * 100).toFixed(1),
      },
      ...metadata,
    });
  }

  d1Error(database: string, operation: string, error: Error, sql?: string, metadata?: Record<string, unknown>): void {
    this.error(`D1 Error: ${operation}`, {
      d1: {
        database,
        operation: operation as any,
        sql: sql ? this.sanitizeSql(sql) : undefined,
        duration: 0,
        success: false,
        error: error.message,
      },
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...metadata,
    });
  }

  cfAnalytics(event: string, value?: number, metadata?: Record<string, unknown>): void {
    this.info(`CF Analytics: ${event}`, {
      analytics: {
        event,
        value,
        timestamp: Date.now(),
      },
      cf: this.cfInfo,
      ...metadata,
    });
  }

  // Performance tracking for Cloudflare context

  trackPagesFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.trackOperation(`pages-function-${name}`, fn);
  }

  trackWorkerOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.trackOperation(`worker-operation-${name}`, fn);
  }

  trackD1Operation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.trackOperation(`d1-operation-${name}`, fn);
  }

  private async trackOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const startCpu = Date.now(); // In real Cloudflare, use performance.now()
    
    this.debug(`Starting operation: ${name}`);
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      const cpuTime = Date.now() - startCpu;
      
      this.debug(`Completed operation: ${name}`, {
        timing: { duration, cpuTime },
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      this.error(`Failed operation: ${name}`, {
        timing: { duration },
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
        },
        success: false,
      });
      
      throw error;
    }
  }

  // Utility methods

  private log(level: CloudflareLogEntry['level'], message: string, metadata?: Record<string, unknown>): void {
    const entry: CloudflareLogEntry = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      level,
      source: this.inferSource(),
      message,
      correlationId: this.correlationId,
      requestId: this.requestId,
      metadata: { ...this.defaultMetadata, ...metadata },
      cf: this.cfInfo,
      worker: this.workerInfo,
      pages: this.pagesInfo,
    };

    // Log to console (Cloudflare captures these)
    const logFn = level === 'error' || level === 'fatal' ? console.error :
                  level === 'warn' ? console.warn : console.log;
    
    logFn(`[CF-${entry.source.toUpperCase()}] ${JSON.stringify(entry)}`);

    // Note: File writing disabled in Cloudflare environment
    // Logs are captured via console and Cloudflare's logging system
  }

  private inferSource(): CloudflareLogEntry['source'] {
    if (this.pagesInfo) return 'pages';
    if (this.workerInfo) return 'worker';
    return 'cloudflare';
  }

  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie'];
    
    headers.forEach((value, key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = value.length > 100 ? `${value.substring(0, 100)}...` : value;
      }
    });
    
    return result;
  }

  private sanitizeSql(sql: string): string {
    // Remove sensitive data and truncate long queries
    let sanitized = sql
      .replace(/('[^']*'|"[^"]*")/g, "'[REDACTED]'") // Replace string literals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return sanitized.length > 200 ? `${sanitized.substring(0, 200)}...` : sanitized;
  }

  // Factory methods for different Cloudflare contexts

  static forPagesFunction(env: any, request: Request, functionName?: string): CloudflareLogger {
    const correlationId = nanoid();
    const requestId = nanoid();
    
    return new CloudflareLogger({
      correlationId,
      requestId,
      cfInfo: this.extractCfInfo(request),
      pagesInfo: {
        environment: env.NODE_ENV === 'production' ? 'production' : 'preview',
        functionName,
      },
    });
  }

  static forWorker(env: any, request?: Request): CloudflareLogger {
    return new CloudflareLogger({
      correlationId: nanoid(),
      requestId: request ? nanoid() : undefined,
      cfInfo: request ? this.extractCfInfo(request) : undefined,
      workerInfo: {
        name: env.WORKER_NAME || 'cloudpilot-api',
        version: env.WORKER_VERSION,
        invocationId: nanoid(),
      },
    });
  }

  static forD1(database: string, correlationId?: string): CloudflareLogger {
    return new CloudflareLogger({
      correlationId: correlationId || nanoid(),
      defaultMetadata: { database },
    });
  }

  private static extractCfInfo(request: Request): CloudflareLogEntry['cf'] {
    const cf = (request as any).cf;
    return cf ? {
      colo: cf.colo,
      country: cf.country,
      city: cf.city,
      region: cf.region,
      timezone: cf.timezone,
      postalCode: cf.postalCode,
      metroCode: cf.metroCode,
      asn: cf.asn,
      asOrganization: cf.asOrganization,
    } : undefined;
  }
}

// Convenience functions for quick logging
export function createPagesLogger(env: any, request: Request, functionName?: string): CloudflareLogger {
  return CloudflareLogger.forPagesFunction(env, request, functionName);
}

export function createWorkerLogger(env: any, request?: Request): CloudflareLogger {
  return CloudflareLogger.forWorker(env, request);
}

export function createD1Logger(database: string, correlationId?: string): CloudflareLogger {
  return CloudflareLogger.forD1(database, correlationId);
}
/**
 * Logger factory and Logger class
 */

import { nanoid } from 'nanoid';
import { LOG_LEVELS } from './constants.js';
import type { LogEntry, LogLevel, LogSource, LogWriter, LoggerConfig } from './types.js';

export class Logger {
  private source: LogSource;
  private writers: LogWriter[];
  private minLevel: number;
  private defaultMetadata: Record<string, unknown>;
  private context: Record<string, unknown> = {};

  constructor(config: LoggerConfig) {
    this.source = config.source;
    this.writers = config.writers;
    this.minLevel = LOG_LEVELS[config.minLevel ?? 'debug'];
    this.defaultMetadata = config.defaultMetadata ?? {};
  }

  // Standard level methods

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

  // Function tracking

  functionEnter(name: string, args?: Record<string, unknown>): void {
    this.debug(`Entering ${name}`, { function: name, args });
  }

  functionExit(name: string, result?: unknown, duration?: number): void {
    this.debug(`Exiting ${name}`, { function: name, result, duration });
  }

  functionError(name: string, error: Error, duration?: number): void {
    this.error(`Error in ${name}`, {
      function: name,
      duration,
      error: this.serializeError(error),
    });
  }

  // HTTP tracking

  httpRequest(method: string, url: string, metadata?: Record<string, unknown>): void {
    this.info(`${method} ${url}`, { http: { method, url }, ...metadata });
  }

  httpResponse(status: number, duration: number, metadata?: Record<string, unknown>): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `Response ${status}`, { http: { status }, duration, ...metadata });
  }

  // Specialized methods

  stateChange(store: string, action: string, prev: unknown, next: unknown): void {
    this.debug(`State change: ${store}.${action}`, { store, action, prev, next });
  }

  // Performance timing methods

  performanceStart(operation: string, metadata?: Record<string, unknown>): void {
    this.debug(`Performance tracking started: ${operation}`, {
      performance: {
        operation,
        status: 'started',
        startTime: Date.now(),
      },
      ...metadata,
    });
  }

  performanceEnd(operation: string, startTime: number, metadata?: Record<string, unknown>): void {
    const duration = Date.now() - startTime;
    const level = duration > 1000 ? 'warn' : 'debug';
    
    this.log(level, `Performance tracking completed: ${operation}`, {
      performance: {
        operation,
        status: 'completed',
        duration,
        slow: duration > 100,
        verySlow: duration > 1000,
      },
      ...metadata,
    });
  }

  performanceWarn(operation: string, duration: number, threshold: number, metadata?: Record<string, unknown>): void {
    this.warn(`Slow performance detected: ${operation}`, {
      performance: {
        operation,
        duration,
        threshold,
        slowPerformanceAlert: true,
        severity: duration > threshold * 2 ? 'critical' : 'warning',
      },
      ...metadata,
    });
  }

  memoryUsage(operation: string, beforeMemory?: NodeJS.MemoryUsage, metadata?: Record<string, unknown>): void {
    const currentMemory = process.memoryUsage();
    const memoryDelta = beforeMemory ? {
      rss: currentMemory.rss - beforeMemory.rss,
      heapUsed: currentMemory.heapUsed - beforeMemory.heapUsed,
      heapTotal: currentMemory.heapTotal - beforeMemory.heapTotal,
      external: currentMemory.external - beforeMemory.external,
    } : undefined;

    this.debug(`Memory usage: ${operation}`, {
      performance: {
        operation,
        memory: {
          current: currentMemory,
          delta: memoryDelta,
          baseline: beforeMemory,
        },
      },
      ...metadata,
    });
  }

  dbQuery(query: string, paramCount: number, duration: number, rowsAffected: number): void {
    this.debug('Database query', { query, paramCount, duration, rowsAffected });
  }

  authEvent(event: string, userId?: string, metadata?: Record<string, unknown>): void {
    this.info(`Auth: ${event}`, { authEvent: event, userId, ...metadata });
  }

  buildStart(type: string, environment: string): void {
    this.info(`Build started: ${type}`, { build: { type, environment, status: 'started' } });
  }

  buildComplete(success: boolean, duration: number, metadata?: Record<string, unknown>): void {
    const level: LogLevel = success ? 'info' : 'error';
    this.log(level, `Build ${success ? 'completed' : 'failed'}`, {
      build: { status: success ? 'completed' : 'failed' },
      duration,
      ...metadata,
    });
  }

  buildError(error: Error, metadata?: Record<string, unknown>): void {
    this.error('Build error', { error: this.serializeError(error), ...metadata });
  }

  gitCommit(hash: string, message: string, filesChanged: number): void {
    this.info(`Git commit: ${hash.slice(0, 7)}`, { git: { hash, message, filesChanged } });
  }

  gitPush(branch: string, remote: string, commits: number): void {
    this.info(`Git push: ${branch} -> ${remote}`, { git: { branch, remote, commits } });
  }

  gitError(operation: string, error: Error): void {
    this.error(`Git error: ${operation}`, {
      git: { operation },
      error: this.serializeError(error),
    });
  }

  // Context management

  child(metadata: Record<string, unknown>): Logger {
    const levelName = (Object.entries(LOG_LEVELS).find(([, v]) => v === this.minLevel)?.[0] ??
      'debug') as LogLevel;

    const child = new Logger({
      source: this.source,
      writers: this.writers,
      minLevel: levelName,
      defaultMetadata: { ...this.defaultMetadata, ...metadata },
    });
    child.context = { ...this.context };
    return child;
  }

  setContext(metadata: Record<string, unknown>): void {
    Object.assign(this.context, metadata);
  }

  withCorrelationId(id: string): Logger {
    return this.child({ correlationId: id });
  }

  async timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.functionEnter(name);
    try {
      const result = await fn();
      this.functionExit(name, undefined, Date.now() - start);
      return result;
    } catch (error) {
      this.functionError(name, error as Error, Date.now() - start);
      throw error;
    }
  }

  // Flush all writers

  async flush(): Promise<void> {
    await Promise.all(this.writers.map((writer) => writer.flush()));
  }

  // Private helpers

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry: LogEntry = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      level,
      source: this.source,
      message,
      ...this.context,
      metadata: { ...this.defaultMetadata, ...metadata },
    };

    // Extract special fields from metadata
    if (entry.metadata) {
      if ('correlationId' in entry.metadata) {
        entry.correlationId = entry.metadata.correlationId as string;
        entry.metadata.correlationId = undefined;
      }
      if ('requestId' in entry.metadata) {
        entry.requestId = entry.metadata.requestId as string;
        entry.metadata.requestId = undefined;
      }
      if ('userId' in entry.metadata) {
        entry.userId = entry.metadata.userId as string;
        entry.metadata.userId = undefined;
      }
      if ('duration' in entry.metadata) {
        entry.duration = entry.metadata.duration as number;
        entry.metadata.duration = undefined;
      }
      if ('error' in entry.metadata && typeof entry.metadata.error === 'object') {
        entry.error = entry.metadata.error as LogEntry['error'];
        entry.metadata.error = undefined;
      }

      // Remove empty metadata object
      if (Object.keys(entry.metadata).length === 0) {
        entry.metadata = undefined;
      }
    }

    for (const writer of this.writers) {
      writer.write(entry);
    }
  }

  private serializeError(error: Error): LogEntry['error'] {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
}

export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

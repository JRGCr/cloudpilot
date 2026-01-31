/**
 * Log query types and constants
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface QueryOptions {
  file: string;
  level?: string;
  source?: string;
  since?: string;
  until?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  search?: string;
  limit: number;
  follow: boolean;
  format: 'json' | 'pretty' | 'compact';
  stats: boolean;
}

export interface Stats {
  total: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  avgDuration?: number;
  errorCount: number;
}

export const LEVEL_PRIORITY: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export const LEVEL_COLORS: Record<string, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
};

export const RESET = '\x1b[0m';
export const DIM = '\x1b[2m';

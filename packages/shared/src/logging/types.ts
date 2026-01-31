/**
 * Logging type definitions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogSource = 'server' | 'client' | 'worker' | 'database' | 'auth' | 'git' | 'build';

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
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
};

export type LogWriter = {
  write(entry: LogEntry): void | Promise<void>;
  flush(): void | Promise<void>;
};

export type LoggerConfig = {
  source: LogSource;
  writers: LogWriter[];
  minLevel?: LogLevel;
  defaultMetadata?: Record<string, unknown>;
};

/**
 * Logging constants
 */

import type { LogLevel } from './types.js';

export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m', // green
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  fatal: '\x1b[35m', // magenta
};

export const RESET_COLOR = '\x1b[0m';
export const DIM_COLOR = '\x1b[2m';
export const BOLD_COLOR = '\x1b[1m';

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const DEFAULT_ROTATED_FILES_KEEP = 5;
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_BATCH_INTERVAL_MS = 2000;

/**
 * Log service - handles client log ingestion
 */

import { type Logger, type Result, err, ok } from '@cloudpilot/shared';

export async function writeLog(entry: unknown, logger?: Logger): Promise<Result<void, Error>> {
  // Validate entry structure
  if (!entry || typeof entry !== 'object') {
    logger?.warn('Invalid log entry received', { entry: typeof entry });
    return err(new Error('Invalid log entry: must be an object'));
  }

  logger?.info('Client log received', { hasEntry: true });
  logger?.debug('Client log details', { entry });

  // In Workers, we can't write to filesystem
  // Options for production:
  // 1. Store in D1
  // 2. Store in KV
  // 3. Forward to external logging service (e.g., Logflare, Datadog)
  // 4. Use Cloudflare Logpush

  // For now, we just log that we received it
  // The server logs will capture this for local development

  return ok(undefined);
}

export async function writeLogs(entries: unknown[], logger?: Logger): Promise<Result<void, Error>> {
  // Validate all entries first
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') {
      logger?.warn('Invalid log entry in batch', { index: i, type: typeof entry });
      return err(new Error(`Invalid log entry at index ${i}: must be an object`));
    }
  }

  logger?.info('Client log batch received', { count: entries.length });
  logger?.debug('Client log batch details', { count: entries.length });

  // Same as writeLog - in production, batch write to storage

  return ok(undefined);
}

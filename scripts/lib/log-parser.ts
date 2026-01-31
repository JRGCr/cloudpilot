/**
 * Log file parsing and reading
 */

import { createReadStream, existsSync, statSync, watchFile } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { matchesFilters } from './log-filters.js';
import { computeStats, formatEntry, printStats } from './log-formatters.js';
import type { LogEntry, QueryOptions } from './log-types.js';

const LOGS_DIR = join(process.cwd(), 'logs');

export function resolveLogFile(file: string): string {
  // If it's a known log type, resolve to logs directory
  const knownFiles = ['server', 'client', 'error', 'build', 'git'];
  if (knownFiles.includes(file)) {
    return join(LOGS_DIR, `${file}.log`);
  }

  // Otherwise, treat as path
  if (existsSync(file)) {
    return file;
  }

  // Try in logs directory
  const inLogs = join(LOGS_DIR, file);
  if (existsSync(inLogs)) {
    return inLogs;
  }

  throw new Error(`Log file not found: ${file}`);
}

export async function queryLogs(options: QueryOptions, log: (msg: string) => void): Promise<void> {
  const filepath = resolveLogFile(options.file);

  if (!existsSync(filepath)) {
    log(`Log file does not exist yet: ${filepath}`);
    if (!options.follow) return;
  }

  const entries: LogEntry[] = [];
  let _lineCount = 0;

  async function processFile(): Promise<void> {
    if (!existsSync(filepath)) return;

    const rl = createInterface({
      input: createReadStream(filepath),
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as LogEntry;

        if (matchesFilters(entry, options)) {
          entries.push(entry);

          if (!options.stats && entries.length <= options.limit) {
            log(formatEntry(entry, options.format));
          }
        }

        _lineCount++;
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  await processFile();

  if (options.stats) {
    printStats(computeStats(entries), log);
  } else if (entries.length > options.limit) {
    log(`\n... and ${entries.length - options.limit} more entries (use --limit to see more)`);
  }

  if (options.follow) {
    log('\n--- Following log file (Ctrl+C to stop) ---\n');

    let lastSize = existsSync(filepath) ? statSync(filepath).size : 0;

    watchFile(filepath, { interval: 500 }, async (curr) => {
      if (curr.size > lastSize) {
        // File grew - read new content
        const stream = createReadStream(filepath, { start: lastSize });
        const rl = createInterface({ input: stream });

        for await (const line of rl) {
          if (!line.trim()) continue;

          try {
            const entry = JSON.parse(line) as LogEntry;

            if (matchesFilters(entry, options)) {
              log(formatEntry(entry, options.format));
            }
          } catch {
            // Skip invalid JSON
          }
        }

        lastSize = curr.size;
      } else if (curr.size < lastSize) {
        // File was truncated/rotated
        lastSize = 0;
      }
    });

    // Keep process alive
    await new Promise(() => {});
  }
}

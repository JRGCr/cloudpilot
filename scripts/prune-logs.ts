#!/usr/bin/env tsx
/**
 * Log pruning script - clean up old log entries
 *
 * Usage:
 *   pnpm logs:prune                    Prune with default retention
 *   pnpm logs:prune --dry-run          Show what would be deleted
 *   pnpm logs:prune --older-than 7d    Delete entries older than 7 days
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';

const LOGS_DIR = join(process.cwd(), 'logs');

interface LogEntry {
  timestamp: string;
  level: string;
  [key: string]: unknown;
}

interface RetentionPolicy {
  debug: number; // hours
  info: number;
  warn: number;
  error: number;
  fatal: number;
}

const DEFAULT_RETENTION: RetentionPolicy = {
  debug: 24, // 1 day
  info: 168, // 7 days
  warn: 720, // 30 days
  error: 2160, // 90 days
  fatal: 2160, // 90 days
};

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_KEEP_ROTATED = 5;

function log(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(message);
}

function parseRelativeTime(time: string): number {
  const match = time.match(/^(\d+)(h|d)$/);
  if (!match) {
    throw new Error(`Invalid time format: ${time}. Use: 24h, 7d, etc.`);
  }

  const [, value, unit] = match;
  const amount = Number.parseInt(value, 10);

  switch (unit) {
    case 'h':
      return amount;
    case 'd':
      return amount * 24;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

function getRetentionHours(level: string, policy: RetentionPolicy): number {
  return policy[level as keyof RetentionPolicy] ?? policy.info;
}

function pruneLogFile(
  filepath: string,
  policy: RetentionPolicy,
  dryRun: boolean,
): { kept: number; removed: number } {
  if (!existsSync(filepath)) {
    return { kept: 0, removed: 0 };
  }

  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  const now = Date.now();

  const kept: string[] = [];
  let removed = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      const entryTime = new Date(entry.timestamp).getTime();
      const retentionHours = getRetentionHours(entry.level, policy);
      const cutoffTime = now - retentionHours * 60 * 60 * 1000;

      if (entryTime >= cutoffTime) {
        kept.push(line);
      } else {
        removed++;
      }
    } catch {
      // Keep malformed lines (could be partial writes)
      kept.push(line);
    }
  }

  if (!dryRun && removed > 0) {
    writeFileSync(filepath, kept.join('\n') + (kept.length > 0 ? '\n' : ''));
  }

  return { kept: kept.length, removed };
}

function cleanupRotatedFiles(filepath: string, keepCount: number, dryRun: boolean): number {
  const dir = LOGS_DIR;
  const baseName = basename(filepath, '.log');

  // Find rotated files matching pattern: basename.YYYY-MM-DDTHH-mm-ss.log
  const rotatedFiles = readdirSync(dir)
    .filter((f) => f.startsWith(baseName) && f !== basename(filepath) && f.endsWith('.log'))
    .map((f) => ({
      name: f,
      path: join(dir, f),
      mtime: statSync(join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime); // Newest first

  const toDelete = rotatedFiles.slice(keepCount);
  let deleted = 0;

  for (const file of toDelete) {
    if (!dryRun) {
      unlinkSync(file.path);
    }
    log(`  ${dryRun ? '[DRY RUN] Would delete' : 'Deleted'}: ${file.name}`);
    deleted++;
  }

  return deleted;
}

function checkAndRotate(filepath: string, maxSize: number, dryRun: boolean): boolean {
  if (!existsSync(filepath)) {
    return false;
  }

  const stats = statSync(filepath);
  if (stats.size < maxSize) {
    return false;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = basename(filepath, '.log');
  const rotatedPath = join(LOGS_DIR, `${baseName}.${timestamp}.log`);

  log(`  Rotating ${basename(filepath)} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);

  if (!dryRun) {
    // Rename current to rotated
    const content = readFileSync(filepath, 'utf-8');
    writeFileSync(rotatedPath, content);
    writeFileSync(filepath, '');
  }

  return true;
}

async function pruneLogs(options: {
  file?: string;
  olderThan?: string;
  maxSize?: number;
  keepRotated?: number;
  dryRun: boolean;
}): Promise<void> {
  const policy = { ...DEFAULT_RETENTION };

  // Override retention if --older-than specified
  if (options.olderThan) {
    const hours = parseRelativeTime(options.olderThan);
    for (const key of Object.keys(policy) as Array<keyof RetentionPolicy>) {
      policy[key] = hours;
    }
  }

  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const keepRotated = options.keepRotated ?? DEFAULT_KEEP_ROTATED;

  // Get log files to process
  const logFiles = options.file
    ? [join(LOGS_DIR, `${options.file}.log`)]
    : readdirSync(LOGS_DIR)
        .filter((f) => f.endsWith('.log') && !f.includes('.'))
        .map((f) => join(LOGS_DIR, f));

  log(`\nPruning logs${options.dryRun ? ' (DRY RUN)' : ''}:\n`);

  let totalKept = 0;
  let totalRemoved = 0;
  let totalRotated = 0;

  for (const filepath of logFiles) {
    const filename = basename(filepath);
    log(`Processing: ${filename}`);

    // Check for rotation first
    if (checkAndRotate(filepath, maxSize, options.dryRun)) {
      totalRotated++;
    }

    // Prune old entries
    const { kept, removed } = pruneLogFile(filepath, policy, options.dryRun);
    totalKept += kept;
    totalRemoved += removed;

    if (removed > 0) {
      log(`  ${options.dryRun ? 'Would remove' : 'Removed'}: ${removed} entries`);
    }

    // Cleanup old rotated files
    const deleted = cleanupRotatedFiles(filepath, keepRotated, options.dryRun);
    if (deleted > 0) {
      log(`  Cleaned up ${deleted} old rotated file(s)`);
    }
  }

  log(`
Summary:
  Entries kept: ${totalKept}
  Entries removed: ${totalRemoved}
  Files rotated: ${totalRotated}
`);
}

// Parse arguments
const args = process.argv.slice(2);

function getArg(names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
  }
  return undefined;
}

function hasFlag(names: string[]): boolean {
  return names.some((name) => args.includes(name));
}

if (hasFlag(['--help', '-h'])) {
  log(`
Log Pruning Tool

Usage:
  pnpm logs:prune [options]

Options:
  --file, -f <file>       Specific log file to prune (server, client, etc.)
  --older-than <time>     Age threshold (e.g., 24h, 7d)
  --max-size <bytes>      Force rotation if file exceeds size (default: 10MB)
  --keep-rotated <n>      Number of rotated files to keep (default: 5)
  --dry-run               Show what would be deleted without actually deleting
  --help, -h              Show this help

Default Retention:
  debug: 24 hours
  info: 7 days
  warn: 30 days
  error/fatal: 90 days

Examples:
  pnpm logs:prune --dry-run
  pnpm logs:prune --older-than 7d
  pnpm logs:prune --file server --older-than 24h
`);
} else {
  const maxSizeArg = getArg(['--max-size']);
  const keepRotatedArg = getArg(['--keep-rotated']);
  pruneLogs({
    file: getArg(['--file', '-f']),
    olderThan: getArg(['--older-than']),
    maxSize: maxSizeArg ? Number.parseInt(maxSizeArg, 10) : undefined,
    keepRotated: keepRotatedArg ? Number.parseInt(keepRotatedArg, 10) : undefined,
    dryRun: hasFlag(['--dry-run']),
  });
}

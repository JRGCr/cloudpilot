#!/usr/bin/env tsx
/**
 * Log query script - search and tail JSON log files
 *
 * Usage:
 *   pnpm logs:query --file server --level error
 *   pnpm logs:query -f client --since 1h --follow
 *   pnpm logs:query --search "database" --stats
 */

import { queryLogs } from './lib/log-parser.js';
import type { QueryOptions } from './lib/log-types.js';

function log(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(message);
}

function error(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(`Error: ${message}`);
  process.exit(1);
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

const options: QueryOptions = {
  file: getArg(['--file', '-f']) || 'server',
  level: getArg(['--level', '-l']),
  source: getArg(['--source', '-s']),
  since: getArg(['--since']),
  until: getArg(['--until']),
  correlationId: getArg(['--correlation-id', '-c']),
  requestId: getArg(['--request-id', '-r']),
  userId: getArg(['--user-id', '-u']),
  search: getArg(['--search', '-q']),
  limit: Number.parseInt(getArg(['--limit', '-n']) || '100', 10),
  follow: hasFlag(['--follow', '-F']),
  format: (getArg(['--format']) as 'json' | 'pretty' | 'compact') || 'pretty',
  stats: hasFlag(['--stats']),
};

if (hasFlag(['--help', '-h'])) {
  log(`
Log Query Tool

Usage:
  pnpm logs:query [options]

Options:
  --file, -f <file>       Log file: server, client, error, build, git, or path
  --level, -l <level>     Minimum level: debug, info, warn, error, fatal
  --source, -s <source>   Filter by source
  --since <time>          Start time (ISO 8601 or relative: 1h, 30m, 7d)
  --until <time>          End time
  --correlation-id, -c    Filter by correlation ID
  --request-id, -r        Filter by request ID
  --user-id, -u           Filter by user ID
  --search, -q <text>     Text search in message and metadata
  --limit, -n <num>       Maximum results (default: 100)
  --follow, -F            Tail mode - watch for new entries
  --format <fmt>          Output: json, pretty, compact (default: pretty)
  --stats                 Show statistics instead of entries
  --help, -h              Show this help

Examples:
  pnpm logs:query --file server --level error
  pnpm logs:query -f client --since 1h --follow
  pnpm logs:query --search "database" --stats
`);
} else {
  queryLogs(options, log).catch((err) => {
    error(err.message);
  });
}

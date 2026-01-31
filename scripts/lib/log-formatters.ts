/**
 * Log formatting and statistics
 */

import { DIM, LEVEL_COLORS, type LogEntry, RESET, type Stats } from './log-types.js';

export function formatEntry(entry: LogEntry, format: 'json' | 'pretty' | 'compact'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(entry);

    case 'compact':
      return `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`;

    default: {
      const color = LEVEL_COLORS[entry.level] || '';
      const time = DIM + entry.timestamp + RESET;
      const level = color + entry.level.toUpperCase().padEnd(5) + RESET;
      const source = `${DIM}[${entry.source}]${RESET}`;
      let msg = `${time} ${level} ${source} ${entry.message}`;

      if (entry.duration !== undefined) {
        msg += `${DIM} (${entry.duration}ms)${RESET}`;
      }

      if (entry.error) {
        msg += `\n  ${color}${entry.error.name}: ${entry.error.message}${RESET}`;
      }

      return msg;
    }
  }
}

export function computeStats(entries: LogEntry[]): Stats {
  const stats: Stats = {
    total: entries.length,
    byLevel: {},
    bySource: {},
    errorCount: 0,
  };

  let totalDuration = 0;
  let durationCount = 0;

  for (const entry of entries) {
    stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
    stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;

    if (entry.duration !== undefined) {
      totalDuration += entry.duration;
      durationCount++;
    }

    if (entry.error) {
      stats.errorCount++;
    }
  }

  if (durationCount > 0) {
    stats.avgDuration = Math.round(totalDuration / durationCount);
  }

  return stats;
}

export function printStats(stats: Stats, log: (msg: string) => void): void {
  log('\nLog Statistics:');
  log(`  Total entries: ${stats.total}`);
  log(`  Errors: ${stats.errorCount}`);

  if (stats.avgDuration !== undefined) {
    log(`  Avg duration: ${stats.avgDuration}ms`);
  }

  log('\n  By Level:');
  for (const [level, count] of Object.entries(stats.byLevel).sort()) {
    log(`    ${level}: ${count}`);
  }

  log('\n  By Source:');
  for (const [source, count] of Object.entries(stats.bySource).sort()) {
    log(`    ${source}: ${count}`);
  }

  log('');
}

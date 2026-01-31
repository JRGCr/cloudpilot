/**
 * Log filtering logic
 */

import { LEVEL_PRIORITY, type LogEntry, type QueryOptions } from './log-types.js';

export function parseRelativeTime(time: string): Date {
  const now = new Date();
  const match = time.match(/^(\d+)(m|h|d)$/);

  if (!match) {
    // Try parsing as ISO date
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid time format: ${time}`);
    }
    return date;
  }

  const [, value, unit] = match;
  const amount = Number.parseInt(value, 10);

  switch (unit) {
    case 'm':
      return new Date(now.getTime() - amount * 60 * 1000);
    case 'h':
      return new Date(now.getTime() - amount * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

export function matchesFilters(entry: LogEntry, options: QueryOptions): boolean {
  // Level filter
  if (options.level) {
    const entryPriority = LEVEL_PRIORITY[entry.level] ?? 0;
    const filterPriority = LEVEL_PRIORITY[options.level] ?? 0;
    if (entryPriority < filterPriority) return false;
  }

  // Source filter
  if (options.source && entry.source !== options.source) {
    return false;
  }

  // Time filters
  if (options.since) {
    const sinceDate = parseRelativeTime(options.since);
    if (new Date(entry.timestamp) < sinceDate) return false;
  }

  if (options.until) {
    const untilDate = parseRelativeTime(options.until);
    if (new Date(entry.timestamp) > untilDate) return false;
  }

  // ID filters
  if (options.correlationId && entry.correlationId !== options.correlationId) {
    return false;
  }

  if (options.requestId && entry.requestId !== options.requestId) {
    return false;
  }

  if (options.userId && entry.userId !== options.userId) {
    return false;
  }

  // Search filter
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    const matches =
      entry.message.toLowerCase().includes(searchLower) ||
      JSON.stringify(entry.metadata || {})
        .toLowerCase()
        .includes(searchLower);
    if (!matches) return false;
  }

  return true;
}

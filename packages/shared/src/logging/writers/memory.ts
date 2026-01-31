/**
 * Memory writer - stores logs in memory (useful for testing)
 */

import type { LogEntry, LogWriter } from '../types.js';

export class MemoryWriter implements LogWriter {
  public entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  flush(): void {
    // No-op
  }

  clear(): void {
    this.entries = [];
  }
}

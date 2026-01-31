/**
 * Fetch writer - sends logs to an HTTP endpoint (for browser clients)
 */

import { DEFAULT_BATCH_INTERVAL_MS, DEFAULT_BATCH_SIZE } from '../constants.js';
import type { LogEntry, LogWriter } from '../types.js';

export class FetchWriter implements LogWriter {
  private endpoint: string;
  private batchSize: number;
  private batchIntervalMs: number;
  private buffer: LogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  constructor(options: { endpoint: string; batchSize?: number; batchIntervalMs?: number }) {
    this.endpoint = options.endpoint;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.batchIntervalMs = options.batchIntervalMs ?? DEFAULT_BATCH_INTERVAL_MS;

    // Register browser event handlers if in browser environment
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });

      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.batchIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Try regular fetch first
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries),
      });

      if (!response.ok) {
        // Put entries back in buffer for retry
        this.buffer.unshift(...entries);
      }
    } catch {
      // Use sendBeacon as fallback (useful during page unload)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, JSON.stringify(entries));
      } else {
        // Put entries back in buffer for retry
        this.buffer.unshift(...entries);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}

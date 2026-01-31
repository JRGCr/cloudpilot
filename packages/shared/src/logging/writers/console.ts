/**
 * Console writer - outputs formatted logs to console
 */

import { DIM_COLOR, LOG_COLORS, RESET_COLOR } from '../constants.js';
import type { LogEntry, LogWriter } from '../types.js';

export class ConsoleWriter implements LogWriter {
  private expandMetadata: boolean;

  constructor(options?: { expandMetadata?: boolean }) {
    this.expandMetadata = options?.expandMetadata ?? false;
  }

  write(entry: LogEntry): void {
    const color = LOG_COLORS[entry.level];
    const timestamp = DIM_COLOR + entry.timestamp + RESET_COLOR;
    const level = color + entry.level.toUpperCase().padEnd(5) + RESET_COLOR;
    const source = `${DIM_COLOR}[${entry.source}]${RESET_COLOR}`;

    let message = `${timestamp} ${level} ${source} ${entry.message}`;

    if (entry.duration !== undefined) {
      message += `${DIM_COLOR} (${entry.duration}ms)${RESET_COLOR}`;
    }

    if (entry.error) {
      message += `\n${color}Error: ${entry.error.name}: ${entry.error.message}${RESET_COLOR}`;
      if (entry.error.stack && this.expandMetadata) {
        message += `\n${DIM_COLOR}${entry.error.stack}${RESET_COLOR}`;
      }
    }

    if (this.expandMetadata && entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\n${DIM_COLOR}${JSON.stringify(entry.metadata, null, 2)}${RESET_COLOR}`;
    }

    switch (entry.level) {
      case 'debug':
        // biome-ignore lint/suspicious/noConsole: Logger needs console access
        console.debug(message);
        break;
      case 'info':
        // biome-ignore lint/suspicious/noConsole: Logger needs console access
        console.info(message);
        break;
      case 'warn':
        // biome-ignore lint/suspicious/noConsole: Logger needs console access
        console.warn(message);
        break;
      case 'error':
      case 'fatal':
        // biome-ignore lint/suspicious/noConsole: Logger needs console access
        console.error(message);
        break;
    }
  }

  flush(): void {
    // No-op for console
  }
}

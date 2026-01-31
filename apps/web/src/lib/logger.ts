/**
 * Client-side logger initialization
 */

import { ConsoleWriter, FetchWriter, type Logger, createLogger } from '@cloudpilot/shared';

let clientLogger: Logger | null = null;

export function initClientLogger(): void {
  if (typeof window === 'undefined') return;

  const apiUrl =
    import.meta.env.VITE_API_URL || 'https://cloudpilot-api.blackbaysolutions.workers.dev';

  const writers = [
    new ConsoleWriter({ expandMetadata: true }),
    new FetchWriter({
      endpoint: `${apiUrl}/logs/batch`,
      batchSize: 50,
      batchIntervalMs: 2000,
    }),
  ];

  clientLogger = createLogger({
    source: 'client',
    writers,
    minLevel: 'debug',
    defaultMetadata: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
  });

  // Capture uncaught errors
  window.addEventListener('error', (event) => {
    clientLogger?.error('Uncaught error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    clientLogger?.error('Unhandled rejection', {
      reason: String(event.reason),
    });
  });
}

export function getClientLogger(): Logger {
  if (!clientLogger) {
    // Return a no-op logger for SSR or before initialization
    return createLogger({
      source: 'client',
      writers: [],
      minLevel: 'fatal',
    });
  }
  return clientLogger;
}

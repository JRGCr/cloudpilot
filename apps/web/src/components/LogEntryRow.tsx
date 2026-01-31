/**
 * LogEntryRow - displays individual log entry
 */

import type { LogEntry, LogLevel } from '@cloudpilot/shared';

interface LogEntryRowProps {
  entry: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#06b6d4', // cyan
  info: '#22c55e', // green
  warn: '#f59e0b', // amber
  error: '#ef4444', // red
  fatal: '#a855f7', // purple
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

export function LogEntryRow({ entry, isExpanded, onToggle }: LogEntryRowProps) {
  const levelColor = LOG_LEVEL_COLORS[entry.level];
  const hasDetails = entry.metadata || entry.error || entry.duration !== undefined;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border)',
        cursor: hasDetails ? 'pointer' : 'default',
      }}
      onClick={hasDetails ? onToggle : undefined}
      onKeyDown={
        hasDetails
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onToggle();
              }
            }
          : undefined
      }
      role={hasDetails ? 'button' : undefined}
      tabIndex={hasDetails ? 0 : undefined}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {formatTimestamp(entry.timestamp)}
        </span>
        <span
          style={{
            color: levelColor,
            fontWeight: 600,
            width: '50px',
            flexShrink: 0,
          }}
        >
          {entry.level.toUpperCase()}
        </span>
        <span
          style={{
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}
        >
          [{entry.source}]
        </span>
        <span style={{ flex: 1, wordBreak: 'break-word' }}>{entry.message}</span>
        {entry.duration !== undefined && (
          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {entry.duration}ms
          </span>
        )}
        {hasDetails && (
          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div
          style={{
            padding: 'var(--space-sm) var(--space-md) var(--space-md)',
            paddingLeft: 'calc(var(--space-md) + 150px)',
            background: 'var(--color-surface)',
          }}
        >
          {entry.error && (
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <strong style={{ color: 'var(--color-error)' }}>Error:</strong>
              <pre
                style={{
                  margin: 'var(--space-xs) 0',
                  padding: 'var(--space-sm)',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'auto',
                  fontSize: '0.8125rem',
                }}
              >
                {entry.error.name}: {entry.error.message}
                {entry.error.stack && `\n\n${entry.error.stack}`}
              </pre>
            </div>
          )}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <strong>Metadata:</strong>
              <pre
                style={{
                  margin: 'var(--space-xs) 0',
                  padding: 'var(--space-sm)',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'auto',
                  fontSize: '0.8125rem',
                }}
              >
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
          {entry.correlationId && (
            <div style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
              Correlation ID: {entry.correlationId}
            </div>
          )}
          {entry.requestId && (
            <div style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
              Request ID: {entry.requestId}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

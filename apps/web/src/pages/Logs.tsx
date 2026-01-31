/**
 * Logs page - displays application logs
 */

import type { LogEntry } from '@cloudpilot/shared';
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogViewer } from '../components/LogViewer';
import { useAuthActions, useIsAuthenticated } from '../lib/hooks';

export function Logs() {
  const isAuthenticated = useIsAuthenticated();
  const { logout } = useAuthActions();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);

      // In a real app, this would fetch from an API endpoint
      // For now, we'll simulate with some mock data
      // The actual implementation would depend on how logs are stored (D1, KV, etc.)

      // Mock implementation - in production, replace with actual API call:
      // const response = await fetch('/api/logs?limit=100');
      // const data = await response.json();
      // setEntries(data.entries);

      // For demo purposes, show empty state
      setEntries([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Polling for new logs
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling, fetchLogs]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Logs</h1>
          <nav style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <a href="/dashboard" style={{ color: 'var(--color-text-muted)' }}>
              Dashboard
            </a>
            <a href="/logs" style={{ fontWeight: 500 }}>
              Logs
            </a>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <input
              type="checkbox"
              checked={isPolling}
              onChange={(e) => setIsPolling(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button type="button" onClick={logout} className="btn btn-secondary">
            Sign out
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--color-error)',
            color: 'white',
            textAlign: 'center',
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              marginLeft: 'var(--space-md)',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Log viewer */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LogViewer entries={entries} onRefresh={fetchLogs} isLoading={isLoading} autoScroll />
      </div>

      {/* Footer with info */}
      <footer
        style={{
          padding: 'var(--space-sm) var(--space-md)',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface)',
        }}
      >
        <p>
          Logs are stored locally in the <code>logs/</code> directory. Use{' '}
          <code>pnpm logs:query</code> for advanced querying.
        </p>
      </footer>
    </div>
  );
}

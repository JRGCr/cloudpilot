/**
 * LogViewer component - displays and filters log entries
 */

import type { LogEntry, LogLevel } from '@cloudpilot/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogEntryRow } from './LogEntryRow.js';
import { LogFilters } from './LogFilters.js';
import { LogStats } from './LogStats.js';

interface LogViewerProps {
  entries: LogEntry[];
  onRefresh?: () => void;
  isLoading?: boolean;
  autoScroll?: boolean;
}

export function LogViewer({
  entries,
  onRefresh,
  isLoading = false,
  autoScroll = true,
}: LogViewerProps) {
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Get unique sources from entries
  const sources = useMemo(() => {
    const uniqueSources = new Set(entries.map((e) => e.source));
    return Array.from(uniqueSources).sort();
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) {
        return false;
      }
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesMessage = entry.message.toLowerCase().includes(query);
        const matchesMetadata = entry.metadata
          ? JSON.stringify(entry.metadata).toLowerCase().includes(query)
          : false;
        if (!matchesMessage && !matchesMetadata) {
          return false;
        }
      }
      return true;
    });
  }, [entries, levelFilter, sourceFilter, searchQuery]);

  // Auto-scroll to bottom when new entries arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredEntries triggers scroll on new entries
  useEffect(() => {
    if (autoScroll) {
      const container = document.getElementById('log-entries');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [filteredEntries, autoScroll]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <LogFilters
        levelFilter={levelFilter}
        sourceFilter={sourceFilter}
        searchQuery={searchQuery}
        sources={sources}
        onLevelChange={setLevelFilter}
        onSourceChange={setSourceFilter}
        onSearchChange={setSearchQuery}
        onRefresh={onRefresh}
        isLoading={isLoading}
      />

      <LogStats filteredCount={filteredEntries.length} totalCount={entries.length} />

      <div
        id="log-entries"
        style={{
          flex: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
      >
        {filteredEntries.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-xl)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            No log entries found
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <LogEntryRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedIds.has(entry.id)}
              onToggle={() => toggleExpanded(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

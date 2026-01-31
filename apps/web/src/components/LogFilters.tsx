/**
 * LogFilters - filter controls for log viewer
 */

import type { LogLevel } from '@cloudpilot/shared';

interface LogFiltersProps {
  levelFilter: LogLevel | 'all';
  sourceFilter: string;
  searchQuery: string;
  sources: string[];
  onLevelChange: (level: LogLevel | 'all') => void;
  onSourceChange: (source: string) => void;
  onSearchChange: (query: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

export function LogFilters({
  levelFilter,
  sourceFilter,
  searchQuery,
  sources,
  onLevelChange,
  onSourceChange,
  onSearchChange,
  onRefresh,
  isLoading = false,
}: LogFiltersProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-md)',
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--color-border)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <select
        className="input"
        style={{ width: 'auto' }}
        value={levelFilter}
        onChange={(e) => onLevelChange(e.target.value as LogLevel | 'all')}
      >
        <option value="all">All Levels</option>
        {LOG_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level.toUpperCase()}
          </option>
        ))}
      </select>

      <select
        className="input"
        style={{ width: 'auto' }}
        value={sourceFilter}
        onChange={(e) => onSourceChange(e.target.value)}
      >
        <option value="all">All Sources</option>
        {sources.map((source) => (
          <option key={source} value={source}>
            {source}
          </option>
        ))}
      </select>

      <input
        type="text"
        className="input"
        placeholder="Search logs..."
        style={{ flex: 1, minWidth: '200px' }}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {onRefresh && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner" /> : 'Refresh'}
        </button>
      )}
    </div>
  );
}

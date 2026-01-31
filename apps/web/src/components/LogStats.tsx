/**
 * LogStats - displays log statistics
 */

interface LogStatsProps {
  filteredCount: number;
  totalCount: number;
}

export function LogStats({ filteredCount, totalCount }: LogStatsProps) {
  return (
    <div
      style={{
        padding: 'var(--space-sm) var(--space-md)',
        fontSize: '0.875rem',
        color: 'var(--color-text-muted)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      Showing {filteredCount} of {totalCount} entries
    </div>
  );
}

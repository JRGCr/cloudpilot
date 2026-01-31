/**
 * Tests for LogViewer component
 */

import type { LogEntry } from '@cloudpilot/shared';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LogViewer } from './LogViewer';

describe('LogViewer', () => {
  const mockEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: '2024-01-31T12:00:00.000Z',
      level: 'info',
      source: 'api',
      message: 'Server started',
      metadata: { port: 3000 },
    },
    {
      id: '2',
      timestamp: '2024-01-31T12:01:00.000Z',
      level: 'error',
      source: 'database',
      message: 'Connection failed',
      error: {
        name: 'ConnectionError',
        message: 'Timeout',
        stack: 'Error stack trace',
      },
    },
    {
      id: '3',
      timestamp: '2024-01-31T12:02:00.000Z',
      level: 'warn',
      source: 'api',
      message: 'High memory usage',
      metadata: { usage: '85%' },
    },
    {
      id: '4',
      timestamp: '2024-01-31T12:03:00.000Z',
      level: 'debug',
      source: 'cache',
      message: 'Cache hit',
    },
  ];

  beforeEach(() => {
    // Clear any previous DOM state
    document.body.innerHTML = '';
  });

  test('renders empty state when no entries', () => {
    render(<LogViewer entries={[]} />);
    expect(screen.getByText('No log entries found')).toBeInTheDocument();
  });

  test('renders log entries', () => {
    render(<LogViewer entries={mockEntries} />);

    expect(screen.getByText('Server started')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('High memory usage')).toBeInTheDocument();
    expect(screen.getByText('Cache hit')).toBeInTheDocument();
  });

  test('displays log stats correctly', () => {
    render(<LogViewer entries={mockEntries} />);

    expect(screen.getByText('Showing 4 of 4 entries')).toBeInTheDocument();
  });

  test('filters by log level', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    // Initially shows all entries
    expect(screen.getByText('Showing 4 of 4 entries')).toBeInTheDocument();

    // Filter by error level
    const levelSelect = screen.getByDisplayValue('All Levels');
    await user.selectOptions(levelSelect, 'error');

    // Should only show error entry
    expect(screen.getByText('Showing 1 of 4 entries')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.queryByText('Server started')).not.toBeInTheDocument();
  });

  test('filters by source', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    // Filter by api source
    const sourceSelect = screen.getByDisplayValue('All Sources');
    await user.selectOptions(sourceSelect, 'api');

    // Should only show api entries
    expect(screen.getByText('Showing 2 of 4 entries')).toBeInTheDocument();
    expect(screen.getByText('Server started')).toBeInTheDocument();
    expect(screen.getByText('High memory usage')).toBeInTheDocument();
    expect(screen.queryByText('Connection failed')).not.toBeInTheDocument();
  });

  test('searches through messages', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'connection');

    // Should only show matching entry
    expect(screen.getByText('Showing 1 of 4 entries')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.queryByText('Server started')).not.toBeInTheDocument();
  });

  test('searches through metadata', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, '3000');

    // Should find entry with port: 3000 in metadata
    expect(screen.getByText('Showing 1 of 4 entries')).toBeInTheDocument();
    expect(screen.getByText('Server started')).toBeInTheDocument();
  });

  test('combines multiple filters', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    // Filter by api source
    const sourceSelect = screen.getByDisplayValue('All Sources');
    await user.selectOptions(sourceSelect, 'api');

    // Then filter by warn level
    const levelSelect = screen.getByDisplayValue('All Levels');
    await user.selectOptions(levelSelect, 'warn');

    // Should only show warn entries from api
    expect(screen.getByText('Showing 1 of 4 entries')).toBeInTheDocument();
    expect(screen.getByText('High memory usage')).toBeInTheDocument();
    expect(screen.queryByText('Server started')).not.toBeInTheDocument();
  });

  test('expands and collapses log entry with metadata', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    // Find the entry with metadata (Server started)
    const entryRow = screen.getByText('Server started').closest('div[role="button"]');
    expect(entryRow).toBeInTheDocument();

    // Initially not expanded - metadata should not be visible
    expect(screen.queryByText('Metadata:')).not.toBeInTheDocument();

    // Click to expand
    if (entryRow) {
      await user.click(entryRow);
    }

    // Metadata should now be visible
    expect(screen.getByText('Metadata:')).toBeInTheDocument();
    expect(screen.getByText(/"port": 3000/)).toBeInTheDocument();

    // Click to collapse
    if (entryRow) {
      await user.click(entryRow);
    }

    // Metadata should be hidden again
    expect(screen.queryByText('Metadata:')).not.toBeInTheDocument();
  });

  test('displays error details when expanded', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    // Find the error entry
    const errorRow = screen.getByText('Connection failed').closest('div[role="button"]');
    expect(errorRow).toBeInTheDocument();

    // Click to expand
    if (errorRow) {
      await user.click(errorRow);
    }

    // Error details should be visible - use getAllByText and check the strong tag
    const errorLabels = screen.getAllByText('Error:');
    const errorLabel = errorLabels.find((el) => el.tagName === 'STRONG');
    expect(errorLabel).toBeInTheDocument();

    expect(screen.getByText(/ConnectionError: Timeout/)).toBeInTheDocument();
    expect(screen.getByText(/Error stack trace/)).toBeInTheDocument();
  });

  test('calls onRefresh when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const mockRefresh = vi.fn();

    render(<LogViewer entries={mockEntries} onRefresh={mockRefresh} />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test('shows loading state on refresh button', () => {
    const { container } = render(
      <LogViewer entries={mockEntries} onRefresh={vi.fn()} isLoading={true} />,
    );

    // When loading, button shows spinner instead of text
    // Find by className since it's in the filters section
    const buttons = screen.getAllByRole('button');
    const refreshButton = buttons.find((btn) => btn.disabled);

    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toBeDisabled();

    // Check for spinner
    const spinner = container.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();
  });

  test('auto-scroll can be disabled', () => {
    // Test that autoScroll prop is accepted
    render(<LogViewer entries={mockEntries} autoScroll={false} />);

    // Component should render without errors
    expect(screen.getByText('Server started')).toBeInTheDocument();
  });

  test('handles empty search results', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'nonexistent');

    // Should show no entries message
    expect(screen.getByText('No log entries found')).toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 4 entries')).toBeInTheDocument();
  });

  test('case-insensitive search', async () => {
    const user = userEvent.setup();
    render(<LogViewer entries={mockEntries} />);

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'CONNECTION');

    // Should find the entry despite case difference
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });
});

/**
 * Tests for ErrorBoundary component
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as loggerModule from '../lib/logger';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Suppress console.error in tests (React prints errors to console)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock the logger
    mockLogger = { error: vi.fn() };
    vi.spyOn(loggerModule, 'getClientLogger').mockReturnValue(
      mockLogger as unknown as ReturnType<typeof loggerModule.getClientLogger>,
    );
  });

  test('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  test('renders fallback UI when error is thrown', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  test('displays error message in fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  test('retry button exists and is clickable', async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Error should be displayed
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Get and click retry button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Click should not throw
    await user.click(retryButton);

    // Button should still be present (component still in error state)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  test('logs error to client logger', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      'React error boundary caught error',
      expect.objectContaining({
        error: expect.objectContaining({
          name: 'Error',
          message: 'Test error',
          stack: expect.any(String),
        }),
        componentStack: expect.any(String),
      }),
    );
  });

  test('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  test('displays default message when error has no message', () => {
    // Component that throws an error without a message
    function ThrowEmptyError() {
      const error = new Error();
      error.message = '';
      throw error;
    }

    render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>,
    );

    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });

  // Restore console.error after each test
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });
});

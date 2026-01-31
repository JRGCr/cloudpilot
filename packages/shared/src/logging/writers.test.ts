import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from './types.js';
import { ConsoleWriter, FetchWriter, MemoryWriter } from './writers.js';

const createMockEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: 'log-123',
  timestamp: '2024-01-15T10:30:00.000Z',
  level: 'info',
  message: 'Test message',
  source: 'test',
  ...overrides,
});

describe('ConsoleWriter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes debug level to console.debug', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ level: 'debug' }));
    expect(console.debug).toHaveBeenCalled();
  });

  it('writes info level to console.info', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ level: 'info' }));
    expect(console.info).toHaveBeenCalled();
  });

  it('writes warn level to console.warn', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ level: 'warn' }));
    expect(console.warn).toHaveBeenCalled();
  });

  it('writes error level to console.error', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ level: 'error' }));
    expect(console.error).toHaveBeenCalled();
  });

  it('writes fatal level to console.error', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ level: 'fatal' }));
    expect(console.error).toHaveBeenCalled();
  });

  it('includes duration in message when present', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ duration: 150 }));
    expect(console.info).toHaveBeenCalled();
    const call = vi.mocked(console.info).mock.calls[0][0];
    expect(call).toContain('150ms');
  });

  it('includes error info when present', () => {
    const writer = new ConsoleWriter();
    writer.write(
      createMockEntry({
        level: 'error',
        error: { name: 'TypeError', message: 'Something went wrong' },
      }),
    );
    expect(console.error).toHaveBeenCalled();
    const call = vi.mocked(console.error).mock.calls[0][0];
    expect(call).toContain('TypeError');
    expect(call).toContain('Something went wrong');
  });

  it('expands metadata when option is enabled', () => {
    const writer = new ConsoleWriter({ expandMetadata: true });
    writer.write(createMockEntry({ metadata: { key: 'value', count: 42 } }));
    expect(console.info).toHaveBeenCalled();
    const call = vi.mocked(console.info).mock.calls[0][0];
    expect(call).toContain('key');
    expect(call).toContain('value');
  });

  it('does not expand metadata by default', () => {
    const writer = new ConsoleWriter();
    writer.write(createMockEntry({ metadata: { key: 'value' } }));
    expect(console.info).toHaveBeenCalled();
    const call = vi.mocked(console.info).mock.calls[0][0];
    expect(call).not.toContain('"key"');
  });

  it('includes error stack when expandMetadata is enabled', () => {
    const writer = new ConsoleWriter({ expandMetadata: true });
    writer.write(
      createMockEntry({
        level: 'error',
        error: {
          name: 'Error',
          message: 'Test',
          stack: 'Error: Test\n    at test.ts:1:1',
        },
      }),
    );
    expect(console.error).toHaveBeenCalled();
    const call = vi.mocked(console.error).mock.calls[0][0];
    expect(call).toContain('at test.ts:1:1');
  });

  it('flush is a no-op', () => {
    const writer = new ConsoleWriter();
    expect(() => writer.flush()).not.toThrow();
  });
});

describe('MemoryWriter', () => {
  it('stores entries in memory', () => {
    const writer = new MemoryWriter();
    const entry1 = createMockEntry({ id: '1' });
    const entry2 = createMockEntry({ id: '2' });

    writer.write(entry1);
    writer.write(entry2);

    expect(writer.entries).toHaveLength(2);
    expect(writer.entries[0]).toEqual(entry1);
    expect(writer.entries[1]).toEqual(entry2);
  });

  it('clears entries', () => {
    const writer = new MemoryWriter();
    writer.write(createMockEntry());
    writer.write(createMockEntry());

    writer.clear();

    expect(writer.entries).toHaveLength(0);
  });

  it('flush is a no-op', () => {
    const writer = new MemoryWriter();
    writer.write(createMockEntry());
    expect(() => writer.flush()).not.toThrow();
    expect(writer.entries).toHaveLength(1);
  });
});

describe('FetchWriter', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('batches entries before sending', () => {
    const writer = new FetchWriter({ endpoint: '/api/logs', batchSize: 3 });

    writer.write(createMockEntry({ id: '1' }));
    writer.write(createMockEntry({ id: '2' }));

    // Not yet sent (batch size not reached)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends when batch size is reached', async () => {
    const writer = new FetchWriter({ endpoint: '/api/logs', batchSize: 2 });

    writer.write(createMockEntry({ id: '1' }));
    writer.write(createMockEntry({ id: '2' }));

    // Batch size reached, should flush
    await vi.runAllTimersAsync();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/logs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('sends on timer if batch size not reached', async () => {
    const writer = new FetchWriter({
      endpoint: '/api/logs',
      batchSize: 10,
      batchIntervalMs: 1000,
    });

    writer.write(createMockEntry());

    // Advance timer
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('retries on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const writer = new FetchWriter({ endpoint: '/api/logs', batchSize: 1 });
    writer.write(createMockEntry());

    await vi.runAllTimersAsync();

    // Entry should be back in buffer, can verify by checking another flush sends it
    mockFetch.mockResolvedValueOnce({ ok: true });
    writer.write(createMockEntry({ id: '2' }));

    await vi.runAllTimersAsync();

    // Should have tried to send twice now
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses sendBeacon on fetch error when available', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const mockSendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis, 'navigator', {
      value: { sendBeacon: mockSendBeacon },
      writable: true,
    });

    const writer = new FetchWriter({ endpoint: '/api/logs', batchSize: 1 });
    writer.write(createMockEntry());

    await vi.runAllTimersAsync();

    expect(mockSendBeacon).toHaveBeenCalledWith('/api/logs', expect.any(String));
  });

  it('flush clears timer', async () => {
    const writer = new FetchWriter({
      endpoint: '/api/logs',
      batchSize: 10,
      batchIntervalMs: 5000,
    });

    writer.write(createMockEntry());

    // Manual flush
    await writer.flush();

    expect(mockFetch).toHaveBeenCalled();
  });

  it('does not flush when already flushing', async () => {
    let resolveFirst: () => void;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    mockFetch.mockImplementationOnce(() => firstPromise.then(() => ({ ok: true })));

    const writer = new FetchWriter({ endpoint: '/api/logs', batchSize: 1 });

    writer.write(createMockEntry({ id: '1' }));

    // Start first flush (won't complete until we resolve)
    const flushPromise = writer.flush();

    // Try second flush while first is in progress
    await writer.flush();

    // Only one call should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Clean up
    resolveFirst?.();
    await flushPromise;
  });

  it('does nothing when buffer is empty', async () => {
    const writer = new FetchWriter({ endpoint: '/api/logs' });

    await writer.flush();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

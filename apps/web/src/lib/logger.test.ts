import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Reset module between tests to clear the singleton
beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getClientLogger', () => {
  it('returns a no-op logger when window is undefined', async () => {
    // @ts-expect-error - Mocking global window
    vi.stubGlobal('window', undefined);

    const { getClientLogger } = await import('./logger.js');
    const logger = getClientLogger();

    // Logger should exist and have the expected methods
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('returns a no-op logger before initialization', async () => {
    const mockWindow = {
      addEventListener: vi.fn(),
      location: { href: 'http://localhost:3000' },
      innerWidth: 1920,
      innerHeight: 1080,
    };
    const mockNavigator = { userAgent: 'Test Browser' };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('document', { visibilityState: 'visible' });

    const { getClientLogger } = await import('./logger.js');
    const logger = getClientLogger();

    // Before init, returns no-op logger
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
  });

  it('returns initialized logger after initClientLogger is called', async () => {
    const mockWindow = {
      addEventListener: vi.fn(),
      location: { href: 'http://localhost:3000/test' },
      innerWidth: 1920,
      innerHeight: 1080,
    };
    const mockNavigator = { userAgent: 'Test Browser', sendBeacon: vi.fn() };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('document', { visibilityState: 'visible' });

    const { initClientLogger, getClientLogger } = await import('./logger.js');

    initClientLogger();

    const logger = getClientLogger();

    expect(logger).toBeDefined();
    // Initialized logger should work without throwing
    expect(() => logger.info('test')).not.toThrow();
  });
});

describe('initClientLogger', () => {
  it('does nothing when window is undefined', async () => {
    // @ts-expect-error - Mocking global window
    vi.stubGlobal('window', undefined);

    const { initClientLogger, getClientLogger } = await import('./logger.js');

    expect(() => initClientLogger()).not.toThrow();

    // Should return no-op logger
    const logger = getClientLogger();
    expect(logger).toBeDefined();
  });

  it('registers error event listeners', async () => {
    const addEventListenerMock = vi.fn();
    const mockWindow = {
      addEventListener: addEventListenerMock,
      location: { href: 'http://localhost:3000' },
      innerWidth: 1920,
      innerHeight: 1080,
    };
    const mockNavigator = { userAgent: 'Test Browser' };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('document', { visibilityState: 'visible' });

    const { initClientLogger } = await import('./logger.js');

    initClientLogger();

    // Should register error and unhandledrejection listeners
    const eventTypes = addEventListenerMock.mock.calls.map((call) => call[0]);
    expect(eventTypes).toContain('error');
    expect(eventTypes).toContain('unhandledrejection');
  });

  it('logs uncaught errors', async () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const mockWindow = {
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners[type] = handler;
      },
      location: { href: 'http://localhost:3000' },
      innerWidth: 1920,
      innerHeight: 1080,
    };
    const mockNavigator = { userAgent: 'Test Browser' };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('document', { visibilityState: 'visible' });

    // Mock console.error to capture log output
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initClientLogger } = await import('./logger.js');

    initClientLogger();

    // Simulate an error event
    if (listeners.error) {
      listeners.error({
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      });
    }

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs unhandled promise rejections', async () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const mockWindow = {
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners[type] = handler;
      },
      location: { href: 'http://localhost:3000' },
      innerWidth: 1920,
      innerHeight: 1080,
    };
    const mockNavigator = { userAgent: 'Test Browser' };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('document', { visibilityState: 'visible' });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initClientLogger } = await import('./logger.js');

    initClientLogger();

    // Simulate unhandled rejection
    if (listeners.unhandledrejection) {
      listeners.unhandledrejection({
        reason: new Error('Unhandled rejection'),
      });
    }

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

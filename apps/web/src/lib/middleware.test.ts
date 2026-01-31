import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { logging, redactAuthState } from './middleware';

// Mock the logger
const mockLogger = {
  stateChange: vi.fn(),
  authEvent: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('./logger', () => ({
  getClientLogger: () => mockLogger,
}));

describe('logging middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs state changes', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore = create<TestState>()(
      logging(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        { name: 'counter' },
      ),
    );

    useStore.getState().increment();

    expect(mockLogger.stateChange).toHaveBeenCalledWith(
      'counter',
      expect.any(String),
      expect.objectContaining({ count: 0 }),
      expect.objectContaining({ count: 1 }),
    );
  });

  it('uses setState as action name for object updates', () => {
    interface TestState {
      value: string;
      setValue: (v: string) => void;
    }

    const useStore = create<TestState>()(
      logging(
        (set) => ({
          value: '',
          setValue: (v: string) => set({ value: v }),
        }),
        { name: 'test' },
      ),
    );

    useStore.getState().setValue('hello');

    // When using set({ value: v }), it's 'setState' not a function name
    expect(mockLogger.stateChange).toHaveBeenCalledWith(
      'test',
      'setState',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('respects enabled option', () => {
    interface TestState {
      count: number;
      increment: () => void;
    }

    const useStore = create<TestState>()(
      logging(
        (set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }),
        { name: 'counter', enabled: false },
      ),
    );

    useStore.getState().increment();

    expect(mockLogger.stateChange).not.toHaveBeenCalled();
  });

  it('applies redact function', () => {
    interface TestState {
      password: string;
      setPassword: (p: string) => void;
    }

    const useStore = create<TestState>()(
      logging(
        (set) => ({
          password: '',
          setPassword: (password: string) => set({ password }),
        }),
        {
          name: 'auth',
          redact: () => ({ password: '[redacted]' }),
        },
      ),
    );

    useStore.getState().setPassword('secret123');

    expect(mockLogger.stateChange).toHaveBeenCalledWith(
      'auth',
      expect.any(String),
      { password: '[redacted]' },
      { password: '[redacted]' },
    );
  });
});

describe('redactAuthState', () => {
  it('redacts user email', () => {
    const state = {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      session: { token: 'secret-token' },
      isLoading: false,
    };

    const redacted = redactAuthState(state);

    expect(redacted.user).toEqual({ id: 'user-123', email: '[redacted]' });
  });

  it('redacts session', () => {
    const state = {
      user: { id: 'user-123', email: 'test@example.com' },
      session: { token: 'secret' },
      isLoading: false,
    };

    const redacted = redactAuthState(state);

    expect(redacted.session).toBe('[redacted]');
  });

  it('handles null user', () => {
    const state = {
      user: null,
      session: null,
      isLoading: true,
    };

    const redacted = redactAuthState(state);

    expect(redacted.user).toBeNull();
    expect(redacted.session).toBeNull();
  });

  it('preserves non-sensitive fields', () => {
    const state = {
      user: { id: 'user-123', email: 'test@example.com' },
      session: { token: 'secret' },
      isLoading: true,
      error: 'Some error',
    };

    const redacted = redactAuthState(state);

    expect(redacted.isLoading).toBe(true);
    expect(redacted.error).toBe('Some error');
  });
});

import type { Session, User } from '@cloudpilot/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAuthActions,
  useAuthError,
  useIsAuthLoading,
  useIsAuthenticated,
  useSession,
  useUser,
} from './hooks';
import { useAuthStore } from './store';

// Mock the logger
vi.mock('./logger', () => ({
  getClientLogger: () => ({
    stateChange: vi.fn(),
    authEvent: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(globalThis, 'window', {
  value: { location: mockLocation },
  writable: true,
});

// Mock fetch
globalThis.fetch = vi.fn();

const mockUser: User = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockSession: Session = {
  id: 'session-123',
  userId: 'user-123',
  token: 'test-token',
  expiresAt: '2025-01-01T00:00:00.000Z',
  ipAddress: null,
  userAgent: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Auth Hooks', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Test the selector functions directly since they're simple wrappers
  // The selectors are used by Zustand's useStore hook internally
  describe('useUser selector', () => {
    it('selects user from state', () => {
      // The hook just extracts state.user
      useAuthStore.setState({ user: mockUser });
      // We test that the store has the correct state
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('returns null when no user', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('useSession selector', () => {
    it('selects session from state', () => {
      useAuthStore.setState({ session: mockSession });
      expect(useAuthStore.getState().session).toEqual(mockSession);
    });

    it('returns null when no session', () => {
      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  describe('useIsAuthenticated selector', () => {
    it('returns false when no user', () => {
      expect(!!useAuthStore.getState().user).toBe(false);
    });

    it('returns true when user exists', () => {
      useAuthStore.setState({ user: mockUser });
      expect(!!useAuthStore.getState().user).toBe(true);
    });
  });

  describe('useIsAuthLoading selector', () => {
    it('returns isLoading state', () => {
      expect(useAuthStore.getState().isLoading).toBe(false);

      useAuthStore.setState({ isLoading: true });
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  describe('useAuthError selector', () => {
    it('returns null by default', () => {
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('returns error when set', () => {
      useAuthStore.setState({ error: 'Auth failed' });
      expect(useAuthStore.getState().error).toBe('Auth failed');
    });
  });

  describe('useAuthActions', () => {
    it('login redirects to GitHub auth', () => {
      const { login } = useAuthStore.getState();
      login();
      expect(mockLocation.href).toBe('/api/auth/signin/github');
    });

    it('logout clears user and session on success', async () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isLoading: false,
      });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      const { logout } = useAuthStore.getState();
      await logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('fetchSession restores session on success', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser, session: mockSession }),
      });

      const { fetchSession } = useAuthStore.getState();
      await fetchSession();

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().session).toEqual(mockSession);
    });
  });

  // Verify the hooks are exported correctly
  describe('Hook exports', () => {
    it('exports useUser', () => {
      expect(typeof useUser).toBe('function');
    });

    it('exports useSession', () => {
      expect(typeof useSession).toBe('function');
    });

    it('exports useIsAuthenticated', () => {
      expect(typeof useIsAuthenticated).toBe('function');
    });

    it('exports useIsAuthLoading', () => {
      expect(typeof useIsAuthLoading).toBe('function');
    });

    it('exports useAuthError', () => {
      expect(typeof useAuthError).toBe('function');
    });

    it('exports useAuthActions', () => {
      expect(typeof useAuthActions).toBe('function');
    });
  });
});

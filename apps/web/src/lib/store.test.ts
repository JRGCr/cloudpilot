import type { Session, User } from '@cloudpilot/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

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

describe('Auth Store', () => {
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

  describe('setUser', () => {
    it('updates user state', () => {
      const { setUser } = useAuthStore.getState();

      setUser(mockUser);

      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('can set user to null', () => {
      useAuthStore.setState({ user: mockUser });
      const { setUser } = useAuthStore.getState();

      setUser(null);

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('setSession', () => {
    it('updates session state', () => {
      const { setSession } = useAuthStore.getState();

      setSession(mockSession);

      expect(useAuthStore.getState().session).toEqual(mockSession);
    });

    it('can set session to null', () => {
      useAuthStore.setState({ session: mockSession });
      const { setSession } = useAuthStore.getState();

      setSession(null);

      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('updates loading state', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('updates error state', () => {
      const { setError } = useAuthStore.getState();

      setError('Test error');
      expect(useAuthStore.getState().error).toBe('Test error');

      setError(null);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isLoading: false,
        error: 'some error',
      });

      const { reset } = useAuthStore.getState();
      reset();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isLoading).toBe(true); // Initial state has isLoading: true
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('redirects to GitHub auth', () => {
      const { login } = useAuthStore.getState();

      login();

      expect(mockLocation.href).toBe('/api/auth/signin/github');
    });
  });

  describe('logout', () => {
    it('clears user and session on success', async () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isLoading: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isLoading: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Logout failed with status 500');
      expect(state.isLoading).toBe(false);
    });

    it('handles network errors', async () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isLoading: false,
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Network error');
    });
  });

  describe('fetchSession', () => {
    it('sets user and session when authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser, session: mockSession }),
      });

      const { fetchSession } = useAuthStore.getState();
      await fetchSession();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.session).toEqual(mockSession);
      expect(state.isLoading).toBe(false);
    });

    it('clears state on 401', async () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { fetchSession } = useAuthStore.getState();
      await fetchSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.error).toBeNull(); // 401 is not an error
    });

    it('sets error on other failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { fetchSession } = useAuthStore.getState();
      await fetchSession();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Failed to fetch session: status 500');
    });

    it('handles missing user in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { fetchSession } = useAuthStore.getState();
      await fetchSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
    });
  });
});

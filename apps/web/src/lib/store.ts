/**
 * Auth store using Zustand
 */

import type { Session, User } from '@cloudpilot/shared';
import { create } from 'zustand';
import { authClient } from './auth-client';
import { getClientLogger } from './logger';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  login: () => void;
  logout: () => Promise<void>;
  fetchSession: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  error: null,
};

// Redact sensitive fields for logging
function redactState(state: AuthState): Record<string, unknown> {
  return {
    user: state.user ? { id: state.user.id, email: '[redacted]' } : null,
    session: state.session ? '[redacted]' : null,
    isLoading: state.isLoading,
    error: state.error,
  };
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  setUser: (user) => {
    const prev = get();
    set({ user });
    getClientLogger().stateChange(
      'auth',
      'setUser',
      redactState(prev),
      redactState({ ...prev, user }),
    );
  },

  setSession: (session) => {
    const prev = get();
    set({ session });
    getClientLogger().stateChange(
      'auth',
      'setSession',
      redactState(prev),
      redactState({ ...prev, session }),
    );
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => {
    const prev = get();
    set(initialState);
    getClientLogger().stateChange('auth', 'reset', redactState(prev), redactState(initialState));
  },

  login: async () => {
    const logger = getClientLogger();
    logger.authEvent('login_initiated');
    // Don't specify callbackURL - let Better Auth use the API domain
    // This ensures OAuth flow uses browser redirects instead of fetch,
    // which allows cookies to be set properly
    await authClient.signIn.social({
      provider: 'github',
    });
  },

  logout: async () => {
    const logger = getClientLogger();
    const prev = get();
    set({ isLoading: true, error: null });

    try {
      await authClient.signOut();
      logger.authEvent('logout_success', prev.user?.id);
      set({ user: null, session: null, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout request failed';
      logger.authEvent('logout_error', prev.user?.id, { error: message });
      set({ error: message, isLoading: false });
    }
  },

  fetchSession: async () => {
    const logger = getClientLogger();
    set({ isLoading: true, error: null });

    try {
      const response = await authClient.getSession();

      // Type guard to check if response has data
      if (response && 'data' in response && response.data) {
        const sessionData = response.data;
        if (sessionData.user && sessionData.session) {
          logger.authEvent('session_restored', sessionData.user.id);
          set({
            user: {
              id: sessionData.user.id,
              name: sessionData.user.name ?? null,
              email: sessionData.user.email,
              emailVerified: sessionData.user.emailVerified ?? false,
              image: sessionData.user.image ?? null,
              createdAt: sessionData.user.createdAt?.toISOString() ?? new Date().toISOString(),
              updatedAt: sessionData.user.updatedAt?.toISOString() ?? new Date().toISOString(),
            },
            session: {
              id: sessionData.session.id,
              userId: sessionData.session.userId,
              token: sessionData.session.token,
              expiresAt: new Date(sessionData.session.expiresAt).toISOString(),
              ipAddress: sessionData.session.ipAddress ?? null,
              userAgent: sessionData.session.userAgent ?? null,
              createdAt: sessionData.session.createdAt?.toISOString() ?? new Date().toISOString(),
              updatedAt: sessionData.session.updatedAt?.toISOString() ?? new Date().toISOString(),
            },
            isLoading: false,
          });
          return;
        }
      }

      logger.authEvent('session_none');
      set({ user: null, session: null, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session fetch request failed';
      logger.authEvent('session_fetch_error', undefined, { error: message });
      set({ user: null, session: null, error: message, isLoading: false });
    }
  },
}));

// Initialize session on load (only in browser)
if (typeof window !== 'undefined') {
  useAuthStore.getState().fetchSession();
}

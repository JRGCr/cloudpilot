/**
 * Auth store using Zustand
 */

import type { Session, User } from '@cloudpilot/shared';
import { create } from 'zustand';
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

  login: () => {
    const logger = getClientLogger();
    logger.authEvent('login_initiated');
    const apiUrl =
      import.meta.env.VITE_API_URL || 'https://cloudpilot-api.blackbaysolutions.workers.dev';
    window.location.href = `${apiUrl}/auth/signin/github`;
  },

  logout: async () => {
    const logger = getClientLogger();
    const prev = get();
    const apiUrl =
      import.meta.env.VITE_API_URL || 'https://cloudpilot-api.blackbaysolutions.workers.dev';

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${apiUrl}/auth/signout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const message = `Logout failed with status ${response.status}`;
        logger.authEvent('logout_error', prev.user?.id, {
          error: message,
          status: response.status,
        });
        set({ error: message, isLoading: false });
        return;
      }

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
    const apiUrl =
      import.meta.env.VITE_API_URL || 'https://cloudpilot-api.blackbaysolutions.workers.dev';

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${apiUrl}/auth/session`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // No session - not an error
          logger.authEvent('session_none');
          set({ user: null, session: null, isLoading: false });
          return;
        }

        const message = `Failed to fetch session: status ${response.status}`;
        logger.authEvent('session_fetch_error', undefined, {
          error: message,
          status: response.status,
        });
        set({ user: null, session: null, error: message, isLoading: false });
        return;
      }

      const data = (await response.json()) as { user?: User; session?: Session };

      if (data.user && data.session) {
        logger.authEvent('session_restored', data.user.id);
        set({
          user: data.user,
          session: data.session,
          isLoading: false,
        });
      } else {
        logger.authEvent('session_incomplete');
        set({ user: null, session: null, isLoading: false });
      }
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

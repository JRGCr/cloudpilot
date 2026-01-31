/**
 * Zustand middleware for logging state changes
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { getClientLogger } from './logger';

type RedactFn<T> = (state: T) => Record<string, unknown>;

interface LoggingOptions<T> {
  name: string;
  redact?: RedactFn<T>;
  enabled?: boolean;
}

type Logging = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  options: LoggingOptions<T>,
) => StateCreator<T, Mps, Mcs>;

type LoggingImpl = <T>(
  f: StateCreator<T, [], []>,
  options: LoggingOptions<T>,
) => StateCreator<T, [], []>;

/**
 * Zustand middleware that logs state changes to the client logger
 *
 * @example
 * ```ts
 * const useStore = create<MyState>()(
 *   logging(
 *     (set) => ({
 *       count: 0,
 *       increment: () => set((state) => ({ count: state.count + 1 })),
 *     }),
 *     {
 *       name: 'counter',
 *       redact: (state) => ({ count: state.count }), // optional
 *     }
 *   )
 * );
 * ```
 */
const loggingImpl: LoggingImpl = (f, options) => (set, get, store) => {
  const { name, redact, enabled = true } = options;

  type SetArgs = Parameters<typeof set>;

  const loggedSet = ((...args: SetArgs) => {
    const prevState = get();

    // Call the original set - use explicit typing to avoid overload issues
    const [partial, replace] = args;
    if (replace === true) {
      set(partial as Parameters<typeof set>[0], true);
    } else {
      set(partial);
    }

    const nextState = get();

    // Log the state change if enabled
    if (enabled) {
      const logger = getClientLogger();
      const prev = redact ? redact(prevState) : prevState;
      const next = redact ? redact(nextState) : nextState;

      // Determine action name from the arguments if possible
      let actionName = 'setState';
      if (typeof args[0] === 'function') {
        actionName = args[0].name || 'anonymous';
      }

      logger.stateChange(
        name,
        actionName,
        prev as Record<string, unknown>,
        next as Record<string, unknown>,
      );
    }
  }) as typeof set;

  return f(loggedSet, get, store);
};

export const logging = loggingImpl as Logging;

/**
 * Default redaction function for auth state
 * Removes sensitive fields like tokens and full user objects
 */
export function redactAuthState<T extends { user?: unknown; session?: unknown }>(
  state: T,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state)) {
    if (key === 'user' && value && typeof value === 'object') {
      const user = value as Record<string, unknown>;
      redacted[key] = {
        id: user.id,
        email: '[redacted]',
      };
    } else if (key === 'session') {
      redacted[key] = value ? '[redacted]' : null;
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Vitest setup for web app (React component tests)
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Define build version globals for tests
(
  globalThis as typeof globalThis & { __BUILD_VERSION__: string; __BUILD_TIME__: string }
).__BUILD_VERSION__ = 'test';
(
  globalThis as typeof globalThis & { __BUILD_VERSION__: string; __BUILD_TIME__: string }
).__BUILD_TIME__ = '2024-01-01T00:00:00.000Z';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

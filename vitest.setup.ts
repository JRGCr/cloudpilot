/**
 * Vitest global setup
 */

import { afterAll, afterEach, beforeAll } from 'vitest';

// Global setup before all tests
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

// Global cleanup after all tests
afterAll(() => {
  // Cleanup if needed
});

// Cleanup after each test
afterEach(() => {
  // Reset mocks, etc.
});

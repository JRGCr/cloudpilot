import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'shared',
      root: './packages/shared',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['../../vitest.setup.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'api',
      root: './apps/api',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['../../vitest.setup.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'web',
      root: './apps/web',
      environment: 'jsdom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['../../vitest.setup.ts', './src/test-setup.ts'],
    },
  },
]);

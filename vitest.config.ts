import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        '**/dist/**',
        'tests',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/index.ts',
        // Config files
        '**/*.config.ts',
        '**/*.config.js',
        // Scripts are CLI tools, not library code
        'scripts/**',
        // Cloudflare functions (edge runtime)
        '**/functions/**',
        // Entry points
        '**/entry-*.ts',
        '**/entry-*.tsx',
        // React pages and components (need integration tests)
        '**/pages/**',
        '**/components/**',
        // Type definition files
        '**/types/**',
        // App.tsx is a router component, tested via E2E
        '**/App.tsx',
        // Vitest workspace config
        'vitest.workspace.ts',
        // Database client (requires D1 runtime)
        '**/db/**',
        // Auth service (requires Better Auth runtime)
        '**/services/auth.ts',
        // Auth proxy routes (requires external auth service)
        '**/routes/auth-proxy.routes.ts',
        '**/routes/auth.routes.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@cloudpilot/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
});

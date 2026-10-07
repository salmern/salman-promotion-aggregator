import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/scraper/**', 'src/verifier/**'],
    },
  },
  resolve: {
    alias: {
      '@promotions/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@promotions/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
});

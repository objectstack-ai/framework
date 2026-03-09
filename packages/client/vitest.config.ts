import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude integration tests that require a running server
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
    ],
    environment: 'node',
  }
});

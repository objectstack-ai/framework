import { defineConfig, configDefaults } from 'vitest/config';

/**
 * Unit tests only. The Playwright browser smoke under `e2e/` also uses
 * `*.spec.ts`, so exclude it here — otherwise vitest tries to run it and chokes
 * on the `@playwright/test` import. Run the smoke with `pnpm test:smoke`.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/e2e/**'],
  },
});

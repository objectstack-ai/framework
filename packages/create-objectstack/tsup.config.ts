// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConfig } from 'tsup';
import { cpSync } from 'fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  shims: true,
  onSuccess: async () => {
    // Copy template files to dist/ so they sit alongside the bundled JS
    cpSync('src/templates', 'dist/templates', { recursive: true });
  },
});

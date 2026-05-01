// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConfig } from 'tsup';

// Compile the host config to dist/ so production `start` can run via
// `objectstack serve dist/objectstack.config.js --prebuilt` and skip
// the esbuild/bundle-require runtime overhead used in dev.
export default defineConfig({
  entry: ['objectstack.config.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  // All workspace deps + native modules stay external — they resolve
  // from node_modules at runtime just like in dev.
  external: [/^@objectstack\//, /^@example\//, /^@hono\//, 'hono', '@libsql/client'],
});

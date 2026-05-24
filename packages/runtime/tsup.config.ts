// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  target: 'es2020',
  // Mark driver packages as external so they are resolved at runtime, not bundled
  external: [
    '@objectstack/driver-memory',
    '@objectstack/driver-sql',
    '@objectstack/driver-sqlite-wasm',
    '@objectstack/driver-turso',
    '@objectstack/driver-mongodb',
    '@objectstack/metadata',
    '@objectstack/objectql',
  ],
});

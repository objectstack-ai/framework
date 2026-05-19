// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'identity/index': 'src/identity/index.ts',
    'security/index': 'src/security/index.ts',
    'audit/index': 'src/audit/index.ts',
    'integration/index': 'src/integration/index.ts',
    'metadata/index': 'src/metadata/index.ts',
    'apps/index': 'src/apps/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@objectstack/spec/contracts': path.resolve(__dirname, '../../spec/src/contracts/index.ts'),
      '@objectstack/spec/data': path.resolve(__dirname, '../../spec/src/data/index.ts'),
      '@objectstack/spec/shared': path.resolve(__dirname, '../../spec/src/shared/index.ts'),
      '@objectstack/spec/system': path.resolve(__dirname, '../../spec/src/system/index.ts'),
      '@objectstack/spec': path.resolve(__dirname, '../../spec/src/index.ts'),
    },
  },
});

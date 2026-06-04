// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10_000,
  },
});

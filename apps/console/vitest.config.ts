// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/// <reference types="vitest" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Console test config — pure-function tests only for now (no DOM/RTL).
 * We keep the surface area tiny so the dependency footprint doesn't
 * balloon; full RTL coverage lives in studio for the heavier React work.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});

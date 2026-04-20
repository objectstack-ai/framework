// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Test setup file
 * Configures testing environment and global test utilities
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Node 22+ ships an experimental built-in `localStorage` that is a plain
// empty object without Storage API methods. When `@vitest-environment
// happy-dom` runs, that global can shadow happy-dom's Storage implementation,
// leaving tests with `localStorage.getItem is not a function`. Install a
// minimal in-memory Storage-compatible shim to guarantee consistent behavior
// across Node versions and environments.
function installStorageShim(): void {
  const store = new Map<string, string>();
  const shim = {
    get length() {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key: string, value: string): void {
      store.set(String(key), String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: shim,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: { ...shim },
  });
}

installStorageShim();

// Re-install before each test so tests that mutate localStorage.setItem
// (to simulate quota errors) cannot leak across other tests.
beforeEach(() => {
  installStorageShim();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

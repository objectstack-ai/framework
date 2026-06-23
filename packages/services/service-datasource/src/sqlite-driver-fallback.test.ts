// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  resolveSqliteDriver,
  NATIVE_SQLITE_WASM_FALLBACK_WARNING,
  NATIVE_SQLITE_MEMORY_FALLBACK_WARNING,
} from './sqlite-driver-fallback.js';

// Shared, mutable test state read by the mocked driver constructors. `vi.hoisted`
// makes it available inside the hoisted `vi.mock` factories below.
const state = vi.hoisted(() => ({
  /** Make the native better-sqlite3 driver throw a NODE_MODULE_VERSION-style error. */
  nativeFails: false,
  /** Make the wasm SQLite driver fail to connect (forces the in-memory last resort). */
  wasmFails: false,
  nativeConfigs: [] as any[],
  wasmConfigs: [] as any[],
  memoryCount: 0,
}));

const ABI_ERROR_MESSAGE =
  "The module '/x/better_sqlite3.node' was compiled against a different Node.js version " +
  'using NODE_MODULE_VERSION 141. This version of Node.js requires NODE_MODULE_VERSION 127. ' +
  'Please try re-compiling or re-installing the module.';

vi.mock('@objectstack/driver-sql', () => {
  class SqlDriver {
    public readonly name = 'com.objectstack.driver.sql';
    constructor(public readonly config: any) {
      state.nativeConfigs.push(config);
    }
    async connect(): Promise<void> {
      // Mirrors the real driver: connect() runs mkdir + a PRAGMA whose error it
      // swallows — so it is NOT where the ABI failure surfaces.
    }
    async execute(_sql: string): Promise<unknown> {
      // better-sqlite3 loads its native addon lazily at the first query, so the
      // ABI mismatch surfaces here (the SELECT 1 probe), not at construction.
      if (state.nativeFails) throw new Error(ABI_ERROR_MESSAGE);
      return [{ ok: 1 }];
    }
    async disconnect(): Promise<void> {}
  }
  return { SqlDriver };
});

vi.mock('@objectstack/driver-sqlite-wasm', () => {
  class SqliteWasmDriver {
    public readonly name = 'com.objectstack.driver.sqlite-wasm';
    constructor(public readonly config: any) {
      state.wasmConfigs.push(config);
    }
    async connect(): Promise<void> {
      if (state.wasmFails) throw new Error('wasm sqlite failed to initialise');
    }
    async execute(): Promise<unknown> {
      return [];
    }
    async disconnect(): Promise<void> {}
  }
  return { SqliteWasmDriver };
});

vi.mock('@objectstack/driver-memory', () => {
  class InMemoryDriver {
    public readonly name = 'com.objectstack.driver.memory';
    constructor() {
      state.memoryCount += 1;
    }
  }
  return { InMemoryDriver };
});

describe('resolveSqliteDriver — native better-sqlite3 → wasm → in-memory step-down (#2229)', () => {
  beforeEach(() => {
    state.nativeFails = false;
    state.wasmFails = false;
    state.nativeConfigs = [];
    state.wasmConfigs = [];
    state.memoryCount = 0;
  });

  it('uses native better-sqlite3 on the happy path (no fallback, no warning)', async () => {
    const warn = vi.fn();
    const resolved = await resolveSqliteDriver({ filename: ':memory:', dev: true, warn });

    expect(resolved.engine).toBe('better-sqlite3');
    expect(resolved.label).toBe('SqlDriver(sqlite)');
    expect(resolved.driver.name).toBe('com.objectstack.driver.sql');
    expect(warn).not.toHaveBeenCalled();
    expect(state.wasmConfigs).toHaveLength(0);
    expect(state.memoryCount).toBe(0);
  });

  it('falls back to wasm SQLite when the native addon fails to load, emitting the warning', async () => {
    state.nativeFails = true;
    const warn = vi.fn();

    const resolved = await resolveSqliteDriver({
      filename: '/tmp/proj/.objectstack/data/dev.db',
      dev: true,
      warn,
    });

    expect(resolved.engine).toBe('sqlite-wasm');
    expect(resolved.label).toBe('SqliteWasmDriver');
    expect(resolved.driver.name).toBe('com.objectstack.driver.sqlite-wasm');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(NATIVE_SQLITE_WASM_FALLBACK_WARNING);
    // The persistent file path is preserved (real on-disk persistence via wasm).
    expect(state.wasmConfigs[0].filename).toBe('/tmp/proj/.objectstack/data/dev.db');
    expect(state.wasmConfigs[0].persist).toBe('on-write');
    expect(state.memoryCount).toBe(0);
  });

  it('uses on-disconnect persistence for an ephemeral :memory: wasm fallback', async () => {
    state.nativeFails = true;
    const resolved = await resolveSqliteDriver({ filename: ':memory:', dev: true, warn: vi.fn() });

    expect(resolved.engine).toBe('sqlite-wasm');
    expect(state.wasmConfigs[0].filename).toBe(':memory:');
    expect(state.wasmConfigs[0].persist).toBe('on-disconnect');
  });

  it('drops to InMemoryDriver as a dev-only last resort when neither native nor wasm load', async () => {
    state.nativeFails = true;
    state.wasmFails = true;
    const warn = vi.fn();

    const resolved = await resolveSqliteDriver({ filename: ':memory:', dev: true, warn });

    expect(resolved.engine).toBe('memory');
    expect(resolved.label).toBe('InMemoryDriver');
    expect(state.memoryCount).toBe(1);
    expect(warn).toHaveBeenCalledWith(NATIVE_SQLITE_MEMORY_FALLBACK_WARNING);
  });

  it('forwards autoMigrate / schemaMode to the native driver', async () => {
    await resolveSqliteDriver({ filename: ':memory:', dev: true, autoMigrate: 'safe', schemaMode: 'managed' });
    expect(state.nativeConfigs[0]).toMatchObject({
      client: 'better-sqlite3',
      useNullAsDefault: true,
      autoMigrate: 'safe',
      schemaMode: 'managed',
    });
  });

  it('production (dev=false) is fail-closed — returns native unprobed, never degrades', async () => {
    state.nativeFails = true;
    const warn = vi.fn();

    const resolved = await resolveSqliteDriver({ filename: '/tmp/prod.db', dev: false, warn });

    // The native driver is handed back as-is so the ABI failure surfaces loudly
    // at first use — we must NOT swap in wasm/mingo behind the operator's back.
    expect(resolved.engine).toBe('better-sqlite3');
    expect(resolved.label).toBe('SqlDriver(sqlite)');
    expect(warn).not.toHaveBeenCalled();
    expect(state.wasmConfigs).toHaveLength(0);
    expect(state.memoryCount).toBe(0);
  });

  describe('dev gate defaults to NODE_ENV when not passed explicitly', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('falls back to wasm when dev is omitted and NODE_ENV=development', async () => {
      state.nativeFails = true;
      process.env.NODE_ENV = 'development';
      const resolved = await resolveSqliteDriver({ filename: ':memory:', warn: vi.fn() });
      expect(resolved.engine).toBe('sqlite-wasm');
    });

    it('is fail-closed when dev is omitted and NODE_ENV=production', async () => {
      state.nativeFails = true;
      process.env.NODE_ENV = 'production';
      const resolved = await resolveSqliteDriver({ filename: ':memory:', warn: vi.fn() });
      expect(resolved.engine).toBe('better-sqlite3');
    });
  });
});

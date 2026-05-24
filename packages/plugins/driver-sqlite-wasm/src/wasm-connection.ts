// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Thin wrapper over sql.js {@link Database} that mimics the surface of
 * `better-sqlite3`'s `Database` (only the methods the Knex dialect uses).
 *
 * Persistence is handled here, not in the Knex dialect, so it can be
 * orchestrated per-connection without polluting the SQL execution path.
 */

import type { Database, SqlJsStatic } from 'sql.js';

/** When to flush the in-memory WASM database to disk. */
export type PersistMode =
  | 'on-disconnect'
  | 'on-write'
  | `debounced:${number}`;

export interface WasmConnectionOptions {
  /**
   * On-disk file path. `:memory:` (or any value starting with `:`) skips
   * persistence entirely and the database lives only for the process.
   */
  filename: string;
  /** When to persist. Default: `on-disconnect`. */
  persist?: PersistMode;
  /** Pre-loaded sql.js module. If omitted, loaded lazily on first connect. */
  sqlJs?: SqlJsStatic;
  /**
   * Optional override for the `.wasm` locator passed to `initSqlJs()`.
   * Defaults to resolving the file from the `sql.js` package on disk
   * (works in Node and WebContainer).
   */
  locateFile?: (file: string) => string;
  /** Optional logger; defaults to `console`. */
  logger?: { warn: (msg: string, meta?: unknown) => void };
}

/** Mutation method names that should trigger a persistence cycle. */
const WRITE_METHODS = new Set([
  'run',
  'insert',
  'update',
  'del',
  'counter',
]);

/**
 * Detect whether a Node-style `fs` module is available. WebContainer
 * (StackBlitz) provides Node `fs`; pure-browser environments do not.
 */
async function tryLoadFs(): Promise<typeof import('node:fs/promises') | null> {
  try {
    return await import('node:fs/promises');
  } catch {
    return null;
  }
}

/**
 * Resolve a default sql.js WASM locator. We point sql.js at the `.wasm`
 * file shipped inside `sql.js`'s own `dist/` folder. This avoids requiring
 * the caller to host the WASM separately.
 */
async function defaultLocateFile(): Promise<((file: string) => string) | undefined> {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const pkgJsonPath = require.resolve('sql.js/package.json');
    const { dirname, join } = await import('node:path');
    const dir = dirname(pkgJsonPath);
    return (file: string) => join(dir, 'dist', file);
  } catch {
    return undefined;
  }
}

let cachedSqlJs: Promise<SqlJsStatic> | null = null;

async function loadSqlJs(
  locateFile?: (file: string) => string,
): Promise<SqlJsStatic> {
  if (cachedSqlJs) return cachedSqlJs;
  cachedSqlJs = (async () => {
    const mod = await import('sql.js');
    const initSqlJs = (mod as any).default ?? (mod as any);
    const locator = locateFile ?? (await defaultLocateFile());
    const SQL = await initSqlJs(locator ? { locateFile: locator } : undefined);
    return SQL as SqlJsStatic;
  })();
  return cachedSqlJs;
}

/**
 * A sql.js-backed connection that exposes the `prepare`/`exec`/`close`
 * subset used by Knex's SQLite dialect. Mutations are queued through a
 * configurable persistence strategy so the on-disk file stays in sync.
 */
export class WasmSqliteConnection {
  readonly filename: string;
  readonly persist: PersistMode;
  readonly isEphemeral: boolean;

  private db!: Database;
  private fs: typeof import('node:fs/promises') | null = null;
  private dirty = false;
  private debounceMs = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFlush: Promise<void> | null = null;
  private destroyed = false;
  private logger: { warn: (msg: string, meta?: unknown) => void };

  constructor(opts: WasmConnectionOptions) {
    this.filename = opts.filename;
    this.persist = opts.persist ?? 'on-disconnect';
    this.isEphemeral =
      this.filename === ':memory:' || this.filename.startsWith(':');
    this.logger = opts.logger ?? console;

    if (typeof this.persist === 'string' && this.persist.startsWith('debounced:')) {
      const ms = Number(this.persist.slice('debounced:'.length));
      this.debounceMs = Number.isFinite(ms) && ms > 0 ? ms : 250;
    }
  }

  /** Open the underlying sql.js database, loading bytes from disk if any. */
  async open(sqlJs?: SqlJsStatic, locateFile?: (file: string) => string): Promise<void> {
    const SQL = sqlJs ?? (await loadSqlJs(locateFile));

    if (this.isEphemeral) {
      this.db = new SQL.Database();
      return;
    }

    this.fs = await tryLoadFs();
    if (!this.fs) {
      this.logger.warn(
        '[driver-sqlite-wasm] No node:fs available — falling back to in-memory database. ' +
          'Data will not be persisted across reloads.',
      );
      this.db = new SQL.Database();
      return;
    }

    // Ensure parent directory exists, then load bytes if the file exists.
    const { dirname } = await import('node:path');
    const dir = dirname(this.filename);
    if (dir && dir !== '.') {
      await this.fs.mkdir(dir, { recursive: true });
    }

    let bytes: Uint8Array | undefined;
    try {
      const buf = await this.fs.readFile(this.filename);
      bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
    }

    this.db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  }

  /** Hint that a mutation just executed; schedule a flush if needed. */
  markDirty(method?: string): void {
    if (this.isEphemeral || !this.fs) return;
    if (method && !WRITE_METHODS.has(method)) return;
    this.dirty = true;

    if (this.persist === 'on-write') {
      void this.flush();
      return;
    }
    if (this.debounceMs > 0) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        void this.flush();
      }, this.debounceMs);
    }
    // 'on-disconnect' → flush only at close()
  }

  /** Force a write of the current database state to disk. */
  async flush(): Promise<void> {
    if (this.isEphemeral || !this.fs || this.destroyed) return;
    // If a flush is already in flight, wait for it and then re-flush so any
    // writes that arrived after the in-flight flush's `db.export()` call get
    // persisted too. Without this, on-write mode loses writes that happen
    // between a flush's synchronous export and its async file write.
    if (this.pendingFlush) {
      await this.pendingFlush;
      if (!this.dirty || this.destroyed) return;
    }
    if (!this.dirty) return;

    this.pendingFlush = (async () => {
      try {
        // Snapshot dirty=false BEFORE export so concurrent writes that occur
        // during the async writeFile mark us dirty again and trigger another
        // flush via markDirty.
        this.dirty = false;
        const exported = this.db.export();
        // sql.js returns a Uint8Array; Buffer.from on it shares memory but
        // works fine for writeFile.
        await this.fs!.writeFile(this.filename, Buffer.from(exported));
      } catch (err) {
        // Restore dirty state so a subsequent flush retries.
        this.dirty = true;
        throw err;
      } finally {
        this.pendingFlush = null;
      }
    })();

    await this.pendingFlush;

    // A write that arrived after `db.export()` (synchronous) but before the
    // file write completed will have set dirty=true again. Re-flush to
    // persist it.
    if (this.dirty && !this.destroyed) {
      await this.flush();
    }
  }

  /** Close the database, flushing any pending writes first. */
  async close(): Promise<void> {
    if (this.destroyed) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    try {
      await this.flush();
    } finally {
      this.destroyed = true;
      try {
        this.db.close();
      } catch {
        /* ignore */
      }
    }
  }

  /** Access the raw sql.js database (for the Knex dialect). */
  get raw(): Database {
    return this.db;
  }
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Turso/libSQL Driver for ObjectStack
 *
 * Extends SqlDriver to provide Turso-specific capabilities:
 * - libSQL connection modes (local file, in-memory, embedded replica)
 * - Embedded replica sync mechanism via @libsql/client
 * - Turso-specific capability flags (FTS5, JSON1, CTE, savepoints)
 *
 * All CRUD, schema, query, filter, and introspection logic is inherited
 * from SqlDriver. TursoDriver only overrides connection lifecycle and
 * adds Turso-specific extension points.
 */

import { SqlDriver, type SqlDriverConfig } from '@objectstack/driver-sql';
import type { Client } from '@libsql/client';

// ── Configuration Types ──────────────────────────────────────────────────────

/**
 * Turso driver configuration.
 *
 * Supports the following connection modes:
 * 1. **Local (Embedded):** `url: 'file:./data/local.db'`
 * 2. **In-memory (Ephemeral):** `url: ':memory:'`
 * 3. **Embedded Replica (Hybrid):** `url` (local file or `:memory:`) +
 *    `syncUrl` (remote `libsql://` / `https://` Turso endpoint)
 *
 * In all modes, the primary query engine runs against a local SQLite
 * database (via SqlDriver / Knex + better-sqlite3). In embedded replica
 * mode, `syncUrl` and `authToken` configure synchronization with a remote
 * Turso database via `@libsql/client`.
 *
 * **Note:** A bare remote-only URL (`url: 'libsql://...'`) without
 * `syncUrl` is NOT supported and will throw during `connect()`.
 */
export interface TursoDriverConfig {
  /** Database URL for the local store (`file:` path or `:memory:`) */
  url: string;

  /** JWT auth token for the remote Turso database (used with `syncUrl`) */
  authToken?: string;

  /**
   * AES-256 encryption key for the local database file.
   * Only effective in embedded replica mode (requires `syncUrl`).
   */
  encryptionKey?: string;

  /**
   * Maximum concurrent requests to the remote database.
   * Only effective in embedded replica mode (requires `syncUrl`).
   * Default: 20
   */
  concurrency?: number;

  /** Remote sync URL for embedded replica mode (`libsql://` or `https://`) */
  syncUrl?: string;

  /** Sync configuration for embedded replica mode (requires `syncUrl`) */
  sync?: {
    /** Periodic sync interval in seconds (0 = manual only). Default: 60 */
    intervalSeconds?: number;
    /** Sync immediately on connect. Default: true */
    onConnect?: boolean;
  };

  /**
   * Operation timeout in milliseconds for remote operations.
   * Only effective in embedded replica mode (requires `syncUrl`).
   */
  timeout?: number;
}

// ── Turso Driver ─────────────────────────────────────────────────────────────

/**
 * Turso/libSQL Driver for ObjectStack.
 *
 * Extends SqlDriver to add Turso-specific connection management and
 * embedded replica sync. All CRUD, schema, filtering, aggregation,
 * and introspection are inherited from SqlDriver — zero duplicated logic.
 *
 * @example Local mode
 * ```typescript
 * const driver = new TursoDriver({ url: 'file:./data/app.db' });
 * await driver.connect();
 * ```
 *
 * @example In-memory mode (testing)
 * ```typescript
 * const driver = new TursoDriver({ url: ':memory:' });
 * await driver.connect();
 * ```
 *
 * @example Embedded replica mode
 * ```typescript
 * const driver = new TursoDriver({
 *   url: 'file:./data/replica.db',
 *   syncUrl: 'libsql://my-db-orgname.turso.io',
 *   authToken: process.env.TURSO_AUTH_TOKEN,
 *   sync: { intervalSeconds: 60, onConnect: true },
 * });
 * await driver.connect();
 * ```
 */
export class TursoDriver extends SqlDriver {
  // IDataDriver metadata
  public override readonly name: string = 'com.objectstack.driver.turso';
  public override readonly version: string = '1.0.0';

  public override readonly supports = {
    // Basic CRUD Operations
    create: true,
    read: true,
    update: true,
    delete: true,

    // Bulk Operations
    bulkCreate: true,
    bulkUpdate: true,
    bulkDelete: true,

    // Transaction & Connection Management
    transactions: true,
    savepoints: true,

    // Query Operations
    queryFilters: true,
    queryAggregations: true,
    querySorting: true,
    queryPagination: true,
    queryWindowFunctions: true,
    querySubqueries: true,
    queryCTE: true,
    joins: true,

    // Advanced Features — Turso/libSQL native capabilities
    fullTextSearch: true,  // FTS5
    jsonQuery: true,       // JSON1 extension
    geospatialQuery: false,
    streaming: false,
    jsonFields: true,
    arrayFields: true,
    vectorSearch: false,

    // Schema Management
    schemaSync: true,
    migrations: false,
    indexes: true,

    // Performance & Optimization
    connectionPooling: false, // Turso uses concurrency limits, not connection pools
    preparedStatements: true,
    queryCache: false,
  };

  private tursoConfig: TursoDriverConfig;
  private libsqlClient: Client | null = null;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: TursoDriverConfig) {
    const knexConfig = TursoDriver.toKnexConfig(config);
    super(knexConfig);
    this.tursoConfig = config;
  }

  /**
   * Convert TursoDriverConfig to a Knex-compatible SqlDriverConfig.
   * Extracts the file path from the URL for local/embedded modes.
   *
   * @throws Error if the URL is a remote-only URL without syncUrl
   */
  private static toKnexConfig(config: TursoDriverConfig): SqlDriverConfig {
    if (config.url === ':memory:') {
      return {
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      };
    }

    if (config.url.startsWith('file:')) {
      return {
        client: 'better-sqlite3',
        connection: { filename: config.url.replace(/^file:/, '') },
        useNullAsDefault: true,
      };
    }

    // Remote-only URL (libsql://, https://) — not supported as standalone
    if (!config.syncUrl) {
      throw new Error(
        `TursoDriver: Remote-only URL "${config.url}" is not supported without "syncUrl". ` +
        'Use a local URL (file: or :memory:) with "syncUrl" for embedded replica mode, ' +
        'or use a local/in-memory URL for standalone mode.',
      );
    }

    // Remote URL with syncUrl — use :memory: as the local Knex backend
    // The actual remote sync is handled by @libsql/client
    return {
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    };
  }

  /**
   * Get the Turso-specific configuration.
   */
  getTursoConfig(): Readonly<TursoDriverConfig> {
    return this.tursoConfig;
  }

  // ===================================
  // Lifecycle (Turso-specific overrides)
  // ===================================

  /**
   * Connect the driver and optionally initialize embedded replica sync.
   *
   * 1. Initializes the Knex/better-sqlite3 connection (via SqlDriver.connect)
   * 2. If syncUrl is configured, creates a @libsql/client for sync operations
   * 3. Triggers initial sync if configured
   * 4. Starts periodic sync interval if configured
   */
  override async connect(): Promise<void> {
    await super.connect();

    // Initialize libSQL client for embedded replica sync
    if (this.tursoConfig.syncUrl) {
      const { createClient } = await import('@libsql/client');
      this.libsqlClient = createClient({
        url: this.tursoConfig.url,
        authToken: this.tursoConfig.authToken,
        encryptionKey: this.tursoConfig.encryptionKey,
        syncUrl: this.tursoConfig.syncUrl,
        concurrency: this.tursoConfig.concurrency,
      });

      // Sync on connect if configured (default: true)
      if (this.tursoConfig.sync?.onConnect !== false) {
        await this.sync();
      }

      // Start periodic sync if configured
      const interval = this.tursoConfig.sync?.intervalSeconds;
      if (interval && interval > 0) {
        this.syncIntervalId = setInterval(() => {
          this.sync().catch(() => {
            /* background sync failure is non-fatal */
          });
        }, interval * 1000);
      }
    }
  }

  /**
   * Disconnect the driver, clean up sync intervals, and close libSQL client.
   */
  override async disconnect(): Promise<void> {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    if (this.libsqlClient) {
      this.libsqlClient.close();
      this.libsqlClient = null;
    }

    await super.disconnect();
  }

  // ===================================
  // Turso-specific: Embedded Replica Sync
  // ===================================

  /**
   * Trigger manual sync of the embedded replica with the remote primary.
   * No-op if no syncUrl is configured or libSQL client is not initialized.
   */
  async sync(): Promise<void> {
    if (this.libsqlClient && this.tursoConfig.syncUrl) {
      await this.libsqlClient.sync();
    }
  }

  /**
   * Check if embedded replica sync is configured and active.
   */
  isSyncEnabled(): boolean {
    return !!this.tursoConfig.syncUrl && this.libsqlClient !== null;
  }

  /**
   * Get the underlying @libsql/client instance (if available).
   * Used for advanced operations like direct remote queries.
   */
  getLibsqlClient(): Client | null {
    return this.libsqlClient;
  }
}

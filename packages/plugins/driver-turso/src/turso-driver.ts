// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Turso/libSQL Driver for ObjectStack
 *
 * Extends SqlDriver to provide Turso-specific capabilities:
 * - libSQL connection modes (local, remote, embedded replica)
 * - Embedded replica sync mechanism
 * - Turso-specific capability flags (FTS5, JSON1, CTE, vector search)
 *
 * All CRUD, schema, query, filter, and introspection logic is inherited
 * from SqlDriver. TursoDriver only overrides connection lifecycle and
 * adds Turso-specific extension points.
 */

import { SqlDriver, type SqlDriverConfig } from '@objectstack/driver-sql';
import type { Client } from '@libsql/client';

/**
 * Default ID length for auto-generated IDs.
 */
const DEFAULT_ID_LENGTH = 16;

// ── Configuration Types ──────────────────────────────────────────────────────

/**
 * Turso driver configuration.
 *
 * Supports three connection modes:
 * 1. **Local (Embedded):** `url: 'file:./data/local.db'` or `url: ':memory:'`
 * 2. **Remote (Cloud):** `url: 'libsql://my-db-orgname.turso.io'`
 * 3. **Embedded Replica (Hybrid):** `url` (local file) + `syncUrl` (remote)
 *
 * For local and in-memory modes, the driver uses better-sqlite3 via Knex
 * (inherited from SqlDriver). For embedded replica mode, sync operations
 * are handled via `@libsql/client`.
 */
export interface TursoDriverConfig {
  /** Database URL (`file:`, `:memory:`, `libsql://`, `https://`) */
  url: string;

  /** JWT auth token for remote Turso database */
  authToken?: string;

  /** AES-256 encryption key for local files */
  encryptionKey?: string;

  /** Maximum concurrent requests. Default: 20 */
  concurrency?: number;

  /** Remote sync URL for embedded replica mode */
  syncUrl?: string;

  /** Sync configuration for embedded replica mode */
  sync?: {
    /** Periodic sync interval in seconds (0 = manual only). Default: 60 */
    intervalSeconds?: number;
    /** Sync immediately on connect. Default: true */
    onConnect?: boolean;
  };

  /** Operation timeout in milliseconds */
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
  public override readonly name = 'com.objectstack.driver.turso';
  public override readonly version = '1.0.0';

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
   * Remote-only URLs fall back to in-memory SQLite.
   */
  private static toKnexConfig(config: TursoDriverConfig): SqlDriverConfig {
    let filename = ':memory:';

    if (config.url === ':memory:') {
      filename = ':memory:';
    } else if (config.url.startsWith('file:')) {
      filename = config.url.replace(/^file:/, '');
    }
    // For remote-only URLs (libsql://, https://), use :memory: as the local backend.
    // Writes will be local; use embedded replica mode (syncUrl) for remote persistence.

    return {
      client: 'better-sqlite3',
      connection: { filename },
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

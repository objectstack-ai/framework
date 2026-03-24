// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { DriverOptions, DriverCapabilities } from '../data/driver.zod.js';
import type { QueryAST } from '../data/query.zod.js';

/**
 * IDataDriver - Comprehensive Database Driver Interface
 * 
 * Pure TypeScript interface for all storage adapters (Postgres, Mongo, Excel, Salesforce).
 * Mirrors the capabilities described in `data/driver.zod.ts` (DriverInterfaceSchema) but
 * expressed as a TypeScript interface for type-safe implementation contracts.
 * 
 * This is the contract that all ObjectStack database drivers MUST implement.
 * Use `DriverCapabilitiesSchema` / `DriverConfigSchema` from `data/driver.zod.ts` for
 * runtime capability detection and configuration validation.
 * 
 * @see DriverCapabilitiesSchema for runtime capability flags
 * @see DriverConfigSchema for driver configuration validation
 */
export interface IDataDriver {
  /** Driver unique name (e.g., 'postgresql', 'mongodb', 'rest_api') */
  readonly name: string;

  /** Driver version */
  readonly version: string;

  /** Capabilities descriptor */
  readonly supports: DriverCapabilities;

  // ===========================================================================
  // Lifecycle Management
  // ===========================================================================

  /** Initialize connection pool or authenticate */
  connect(): Promise<void>;

  /** Close connections and cleanup resources */
  disconnect(): Promise<void>;

  /** Check connection health */
  checkHealth(): Promise<boolean>;

  /** Get connection pool statistics (optional) */
  getPoolStats?(): { total: number; idle: number; active: number; waiting: number } | undefined;

  // ===========================================================================
  // Raw Execution (Escape Hatch)
  // ===========================================================================

  /**
   * Execute a raw command/query native to the driver.
   * 
   * @param command - Raw command (SQL string, shell command, or API payload)
   * @param parameters - Bound parameters for safe execution
   * @param options - Driver options (transaction context, timeout)
   * @returns Raw result from the driver
   */
  execute(command: unknown, parameters?: unknown[], options?: DriverOptions): Promise<unknown>;

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Find multiple records matching the structured query.
   * MUST return `id` as string. MUST NOT return implementation details like `_id`.
   */
  find(object: string, query: QueryAST, options?: DriverOptions): Promise<Record<string, unknown>[]>;

  /**
   * Stream records matching the structured query.
   * Optimized for large datasets to avoid memory overflow.
   * Returns an AsyncIterable or ReadableStream.
   */
  findStream(object: string, query: QueryAST, options?: DriverOptions): unknown;

  /**
   * Find a single record by query.
   * MUST return `id` as string. MUST NOT return implementation details like `_id`.
   */
  findOne(object: string, query: QueryAST, options?: DriverOptions): Promise<Record<string, unknown> | null>;

  /**
   * Create a new record.
   * MUST return `id` as string. MUST NOT return implementation details like `_id`.
   */
  create(object: string, data: Record<string, unknown>, options?: DriverOptions): Promise<Record<string, unknown>>;

  /**
   * Update an existing record by ID.
   * MUST return `id` as string. MUST NOT return implementation details like `_id`.
   */
  update(object: string, id: string | number, data: Record<string, unknown>, options?: DriverOptions): Promise<Record<string, unknown>>;

  /**
   * Upsert (Update or Insert) a record.
   */
  upsert(object: string, data: Record<string, unknown>, conflictKeys?: string[], options?: DriverOptions): Promise<Record<string, unknown>>;

  /**
   * Delete a record by ID.
   * @returns True if deleted, false if not found.
   */
  delete(object: string, id: string | number, options?: DriverOptions): Promise<boolean>;

  /**
   * Count records matching a query.
   */
  count(object: string, query?: QueryAST, options?: DriverOptions): Promise<number>;

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /** Create multiple records in a single batch */
  bulkCreate(object: string, dataArray: Record<string, unknown>[], options?: DriverOptions): Promise<Record<string, unknown>[]>;

  /** Update multiple records in a single batch */
  bulkUpdate(object: string, updates: Array<{ id: string | number; data: Record<string, unknown> }>, options?: DriverOptions): Promise<Record<string, unknown>[]>;

  /** Delete multiple records in a single batch */
  bulkDelete(object: string, ids: Array<string | number>, options?: DriverOptions): Promise<void>;

  /** Update multiple records matching a query (optional) */
  updateMany?(object: string, query: QueryAST, data: Record<string, unknown>, options?: DriverOptions): Promise<number>;

  /** Delete multiple records matching a query (optional) */
  deleteMany?(object: string, query: QueryAST, options?: DriverOptions): Promise<number>;

  // ===========================================================================
  // Transaction Management
  // ===========================================================================

  /**
   * Begin a new database transaction.
   * @returns A transaction handle to pass via `options.transaction`.
   */
  beginTransaction(options?: { isolationLevel?: string }): Promise<unknown>;

  /** Commit the transaction */
  commit(transaction: unknown): Promise<void>;

  /** Rollback the transaction */
  rollback(transaction: unknown): Promise<void>;

  // ===========================================================================
  // Schema Management
  // ===========================================================================

  /**
   * Synchronize the database schema with the Object definition.
   * Idempotent: creates tables if missing, adds columns, updates indexes.
   */
  syncSchema(object: string, schema: unknown, options?: DriverOptions): Promise<void>;

  /**
   * Batch-synchronize multiple object schemas in a single round-trip.
   *
   * Drivers that set `supports.batchSchemaSync = true` MUST implement this.
   * The engine calls it once with all `{ object, schema }` pairs instead
   * of calling `syncSchema()` N times, reducing network overhead for
   * remote drivers.
   */
  syncSchemasBatch?(schemas: Array<{ object: string; schema: unknown }>, options?: DriverOptions): Promise<void>;

  /** Drop the underlying table or collection (destructive) */
  dropTable(object: string, options?: DriverOptions): Promise<void>;

  /**
   * Analyze query performance.
   * Returns execution plan without executing the query (optional).
   */
  explain?(object: string, query: QueryAST, options?: DriverOptions): Promise<unknown>;
}

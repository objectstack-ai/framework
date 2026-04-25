// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Database Metadata Loader
 *
 * Loads and persists metadata via an IDataDriver instance, enabling
 * database-backed storage for platform and user scoped metadata.
 * Uses the `sys_metadata` table (configurable) following the
 * MetadataRecordSchema envelope defined in @objectstack/spec.
 */

import type {
  MetadataLoadOptions,
  MetadataLoadResult,
  MetadataStats,
  MetadataLoaderContract,
  MetadataSaveOptions,
  MetadataSaveResult,
  MetadataRecord,
  MetadataHistoryRecord,
} from '@objectstack/spec/system';
import { SysMetadataObject, SysMetadataHistoryObject } from '@objectstack/system-objects/metadata';
import type { IDataDriver, IDataEngine } from '@objectstack/spec/contracts';
import type { MetadataLoader } from './loader-interface.js';
import { calculateChecksum } from '../utils/metadata-history-utils.js';
import { MetadataProjector } from '../projection/metadata-projector.js';

/**
 * Configuration for the DatabaseLoader.
 *
 * Accepts either a raw `IDataDriver` or an `IDataEngine` (ObjectQL).
 * When `engine` is provided, all CRUD operations route through the engine
 * which handles datasource mapping automatically — no manual driver
 * resolution needed. Schema sync is also skipped (the engine handles it).
 */
export interface DatabaseLoaderOptions {
  /** The IDataDriver instance to use for database operations */
  driver?: IDataDriver;

  /** The IDataEngine (ObjectQL) instance — preferred over raw driver */
  engine?: IDataEngine;

  /** The table name to store metadata records (default: 'sys_metadata') */
  tableName?: string;

  /** The table name to store history records (default: 'sys_metadata_history') */
  historyTableName?: string;

  /** Organization ID for multi-tenant isolation */
  organizationId?: string;

  /** Environment ID — null = platform-global, set = env-scoped */
  environmentId?: string;

  /** Enable history tracking (default: true) */
  trackHistory?: boolean;

  /** Enable metadata projection to type-specific tables (default: true) */
  enableProjection?: boolean;
}

/**
 * DatabaseLoader — Datasource-backed metadata persistence.
 *
 * Implements the MetadataLoader interface to provide database read/write
 * for metadata records. Uses the MetadataRecordSchema envelope to persist
 * metadata with scope, versioning, and audit fields.
 */
export class DatabaseLoader implements MetadataLoader {
  readonly contract: MetadataLoaderContract = {
    name: 'database',
    protocol: 'datasource:',
    capabilities: {
      read: true,
      write: true,
      watch: false,
      list: true,
    },
  };

  private driver?: IDataDriver;
  private engine?: IDataEngine;
  private tableName: string;
  private historyTableName: string;
  private organizationId?: string;
  private environmentId?: string;
  private trackHistory: boolean;
  private schemaReady = false;
  private historySchemaReady = false;
  private enableProjection: boolean;
  private projector?: MetadataProjector;

  constructor(options: DatabaseLoaderOptions) {
    if (!options.driver && !options.engine) {
      throw new Error('DatabaseLoader requires either a driver or engine');
    }
    this.driver = options.driver;
    this.engine = options.engine;
    this.tableName = options.tableName ?? 'sys_metadata';
    this.historyTableName = options.historyTableName ?? 'sys_metadata_history';
    this.organizationId = options.organizationId;
    this.environmentId = options.environmentId;
    this.trackHistory = options.trackHistory !== false; // Default to true
    this.enableProjection = options.enableProjection !== false; // Default to true

    // Initialize projector if projection is enabled
    if (this.enableProjection) {
      this.projector = new MetadataProjector({
        driver: this.driver,
        engine: this.engine,
        organizationId: this.organizationId,
        environmentId: this.environmentId,
      });
    }
  }

  // ==========================================
  // Internal CRUD helpers (driver vs engine)
  // ==========================================

  private async _find(table: string, query: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    if (this.engine) {
      return this.engine.find(table, query as any);
    }
    return this.driver!.find(table, { object: table, ...query } as any);
  }

  private async _findOne(table: string, query: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (this.engine) {
      return this.engine.findOne(table, query as any);
    }
    return this.driver!.findOne(table, { object: table, ...query } as any);
  }

  private async _count(table: string, query: Record<string, unknown>): Promise<number> {
    if (this.engine) {
      return this.engine.count(table, query as any);
    }
    return this.driver!.count(table, { object: table, ...query } as any);
  }

  private async _create(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.engine) {
      return this.engine.insert(table, data);
    }
    return this.driver!.create(table, data);
  }

  private async _update(table: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.engine) {
      return this.engine.update(table, { id, ...data });
    }
    return this.driver!.update(table, id, data);
  }

  private async _delete(table: string, id: string): Promise<any> {
    if (this.engine) {
      return this.engine.delete(table, { where: { id } } as any);
    }
    return this.driver!.delete(table, id);
  }

  /**
   * Ensure the metadata table exists.
   * Uses IDataDriver.syncSchema with the SysMetadataObject definition
   * to idempotently create/update the table.
   */
  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;

    // When using engine, schema sync is handled by ObjectQL startup
    if (this.engine) {
      this.schemaReady = true;
      return;
    }

    try {
      await this.driver!.syncSchema(this.tableName, {
        ...SysMetadataObject,
        name: this.tableName,
      });
      this.schemaReady = true;
    } catch {
      // If syncSchema fails (e.g. table already exists), mark ready and continue
      this.schemaReady = true;
    }
  }

  /**
   * Ensure the history table exists.
   * Uses IDataDriver.syncSchema with the SysMetadataHistoryObject definition.
   */
  private async ensureHistorySchema(): Promise<void> {
    if (!this.trackHistory || this.historySchemaReady) return;

    // When using engine, schema sync is handled by ObjectQL startup
    if (this.engine) {
      this.historySchemaReady = true;
      return;
    }

    try {
      await this.driver!.syncSchema(this.historyTableName, {
        ...SysMetadataHistoryObject,
        name: this.historyTableName,
      });
      this.historySchemaReady = true;
    } catch (error) {
      // Log the error; historySchemaReady remains false so the next operation retries.
      // If the error is a benign "already exists" the next attempt will also succeed.
      console.error('Failed to ensure history schema, will retry on next operation:', error);
    }
  }

  /**
   * Build base filter conditions for queries.
   * Filters by organizationId when configured; env_id when environmentId is set,
   * or null (platform-global) when not set.
   */
  private baseFilter(type: string, name?: string): Record<string, unknown> {
    const filter: Record<string, unknown> = { type };
    if (name !== undefined) {
      filter.name = name;
    }
    if (this.organizationId) {
      filter.organization_id = this.organizationId;
    }
    // When environmentId is set, scope to that env; otherwise query platform-global (env_id = null).
    filter.env_id = this.environmentId ?? null;
    return filter;
  }

  /**
   * Create a history record for a metadata change.
   *
   * @param metadataId - The metadata record ID
   * @param type - Metadata type
   * @param name - Metadata name
   * @param version - Version number
   * @param metadata - The metadata payload
   * @param operationType - Type of operation
   * @param previousChecksum - Checksum of previous version (if any)
   * @param changeNote - Optional change description
   * @param recordedBy - Optional user who made the change
   */
  private async createHistoryRecord(
    metadataId: string,
    type: string,
    name: string,
    version: number,
    metadata: unknown,
    operationType: 'create' | 'update' | 'publish' | 'revert' | 'delete',
    previousChecksum?: string,
    changeNote?: string,
    recordedBy?: string
  ): Promise<void> {
    if (!this.trackHistory) return;

    await this.ensureHistorySchema();

    const now = new Date().toISOString();
    const checksum = await calculateChecksum(metadata);

    // Skip if checksum matches previous version (no actual change)
    if (previousChecksum && checksum === previousChecksum && operationType === 'update') {
      return;
    }

    const historyId = generateId();
    const metadataJson = JSON.stringify(metadata);

    const historyRecord: Partial<MetadataHistoryRecord> = {
      id: historyId,
      metadataId,
      name,
      type,
      version,
      operationType,
      metadata: metadataJson as any,
      checksum,
      previousChecksum,
      changeNote,
      recordedBy,
      recordedAt: now,
      ...(this.organizationId ? { organizationId: this.organizationId } : {}),
      ...(this.environmentId !== undefined ? { environmentId: this.environmentId } : {}),
    };

    try {
      await this._create(this.historyTableName, {
        id: historyRecord.id,
        metadata_id: historyRecord.metadataId,
        name: historyRecord.name,
        type: historyRecord.type,
        version: historyRecord.version,
        operation_type: historyRecord.operationType,
        metadata: historyRecord.metadata,
        checksum: historyRecord.checksum,
        previous_checksum: historyRecord.previousChecksum,
        change_note: historyRecord.changeNote,
        recorded_by: historyRecord.recordedBy,
        recorded_at: historyRecord.recordedAt,
        ...(this.organizationId ? { organization_id: this.organizationId } : {}),
        ...(this.environmentId !== undefined ? { env_id: this.environmentId } : {}),
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error(`Failed to create history record for ${type}/${name}:`, error);
    }
  }

  /**
   * Convert a database row to a metadata payload.
   * Parses the JSON `metadata` column back into an object.
   */
  private rowToData(row: Record<string, unknown>): Record<string, unknown> | null {
    if (!row || !row.metadata) return null;

    const payload = typeof row.metadata === 'string'
      ? JSON.parse(row.metadata as string)
      : row.metadata;

    return payload as Record<string, unknown>;
  }

  /**
   * Convert a database row to a MetadataRecord-like object.
   */
  private rowToRecord(row: Record<string, unknown>): MetadataRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      namespace: (row.namespace as string) ?? 'default',
      packageId: row.package_id as string | undefined,
      managedBy: row.managed_by as MetadataRecord['managedBy'],
      scope: (row.scope as MetadataRecord['scope']) ?? 'platform',
      metadata: this.rowToData(row) ?? {},
      extends: row.extends as string | undefined,
      strategy: (row.strategy as MetadataRecord['strategy']) ?? 'merge',
      owner: row.owner as string | undefined,
      state: (row.state as MetadataRecord['state']) ?? 'active',
      organizationId: row.organization_id as string | undefined,
      environmentId: row.env_id as string | undefined,
      version: (row.version as number) ?? 1,
      checksum: row.checksum as string | undefined,
      source: row.source as MetadataRecord['source'],
      tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags as string) : row.tags as string[]) : undefined,
      createdBy: row.created_by as string | undefined,
      createdAt: row.created_at as string | undefined,
      updatedBy: row.updated_by as string | undefined,
      updatedAt: row.updated_at as string | undefined,
    };
  }

  // ==========================================
  // MetadataLoader Interface Implementation
  // ==========================================

  async load(
    type: string,
    name: string,
    _options?: MetadataLoadOptions
  ): Promise<MetadataLoadResult> {
    const startTime = Date.now();

    await this.ensureSchema();

    try {
      const row = await this._findOne(this.tableName, {
        where: this.baseFilter(type, name),
      });

      if (!row) {
        return {
          data: null,
          loadTime: Date.now() - startTime,
        };
      }

      const data = this.rowToData(row);
      const record = this.rowToRecord(row);

      return {
        data,
        source: 'database',
        format: 'json',
        etag: record.checksum,
        loadTime: Date.now() - startTime,
      };
    } catch {
      return {
        data: null,
        loadTime: Date.now() - startTime,
      };
    }
  }

  async loadMany<T = any>(
    type: string,
    _options?: MetadataLoadOptions
  ): Promise<T[]> {
    await this.ensureSchema();

    try {
      const rows = await this._find(this.tableName, {
        where: this.baseFilter(type),
      });

      return rows
        .map(row => this.rowToData(row))
        .filter((data): data is Record<string, unknown> => data !== null) as T[];
    } catch {
      return [];
    }
  }

  async exists(type: string, name: string): Promise<boolean> {
    await this.ensureSchema();

    try {
      const count = await this._count(this.tableName, {
        where: this.baseFilter(type, name),
      });

      return count > 0;
    } catch {
      return false;
    }
  }

  async stat(type: string, name: string): Promise<MetadataStats | null> {
    await this.ensureSchema();

    try {
      const row = await this._findOne(this.tableName, {
        where: this.baseFilter(type, name),
      });

      if (!row) return null;

      const record = this.rowToRecord(row);
      const metadataStr = typeof row.metadata === 'string'
        ? row.metadata as string
        : JSON.stringify(row.metadata);

      return {
        size: metadataStr.length,
        mtime: record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
        format: 'json',
        etag: record.checksum,
      };
    } catch {
      return null;
    }
  }

  async list(type: string): Promise<string[]> {
    await this.ensureSchema();

    try {
      const rows = await this._find(this.tableName, {
        where: this.baseFilter(type),
        fields: ['name'],
      });

      return rows
        .map(row => row.name as string)
        .filter(name => typeof name === 'string');
    } catch {
      return [];
    }
  }

  /**
   * Fetch a single history snapshot by (type, name, version).
   * Returns null when the record does not exist.
   */
  async getHistoryRecord(
    type: string,
    name: string,
    version: number
  ): Promise<MetadataHistoryRecord | null> {
    if (!this.trackHistory) return null;

    await this.ensureHistorySchema();

    // Resolve the parent metadata record ID
    const metadataRow = await this._findOne(this.tableName, {
      where: this.baseFilter(type, name),
    });
    if (!metadataRow) return null;

    const filter: Record<string, unknown> = {
      metadata_id: metadataRow.id,
      version,
    };
    if (this.organizationId) {
      filter.organization_id = this.organizationId;
    }
    filter.env_id = this.environmentId ?? null;

    const row = await this._findOne(this.historyTableName, {
      where: filter,
    });
    if (!row) return null;

    return {
      id: row.id as string,
      metadataId: row.metadata_id as string,
      name: row.name as string,
      type: row.type as string,
      version: row.version as number,
      operationType: row.operation_type as MetadataHistoryRecord['operationType'],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata as string) : row.metadata,
      checksum: row.checksum as string,
      previousChecksum: row.previous_checksum as string | undefined,
      changeNote: row.change_note as string | undefined,
      organizationId: row.organization_id as string | undefined,
      environmentId: row.env_id as string | undefined,
      recordedBy: row.recorded_by as string | undefined,
      recordedAt: row.recorded_at as string,
    };
  }

  /**
   * Query history records with pagination and filtering.
   * Encapsulates history table queries so MetadataManager doesn't need
   * direct driver access.
   */
  async queryHistory(
    type: string,
    name: string,
    options?: {
      operationType?: string;
      since?: string;
      until?: string;
      limit?: number;
      offset?: number;
      includeMetadata?: boolean;
    }
  ): Promise<{ records: any[]; total: number; hasMore: boolean }> {
    if (!this.trackHistory) {
      return { records: [], total: 0, hasMore: false };
    }

    await this.ensureSchema();
    await this.ensureHistorySchema();

    // Find the metadata record
    const filter: Record<string, unknown> = { type, name };
    if (this.organizationId) filter.organization_id = this.organizationId;
    filter.env_id = this.environmentId ?? null;

    const metadataRecord = await this._findOne(this.tableName, { where: filter });
    if (!metadataRecord) {
      return { records: [], total: 0, hasMore: false };
    }

    // Build history query
    const historyFilter: Record<string, unknown> = {
      metadata_id: metadataRecord.id,
    };
    if (this.organizationId) historyFilter.organization_id = this.organizationId;
    historyFilter.env_id = this.environmentId ?? null;
    if (options?.operationType) historyFilter.operation_type = options.operationType;
    if (options?.since) historyFilter.recorded_at = { $gte: options.since };
    if (options?.until) {
      if (historyFilter.recorded_at) {
        (historyFilter.recorded_at as Record<string, unknown>).$lte = options.until;
      } else {
        historyFilter.recorded_at = { $lte: options.until };
      }
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const historyRecords = await this._find(this.historyTableName, {
      where: historyFilter,
      orderBy: [
        { field: 'recorded_at', order: 'desc' as const },
        { field: 'version', order: 'desc' as const },
      ],
      limit: limit + 1,
      offset,
    });

    const hasMore = historyRecords.length > limit;
    const records = historyRecords.slice(0, limit);
    const total = await this._count(this.historyTableName, { where: historyFilter });

    const includeMetadata = options?.includeMetadata !== false;
    const result = records.map((row: Record<string, unknown>) => {
      const parsedMetadata =
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata as string)
          : (row.metadata as Record<string, unknown> | null | undefined);

      return {
        id: row.id as string,
        metadataId: row.metadata_id as string,
        name: row.name as string,
        type: row.type as string,
        version: row.version as number,
        operationType: row.operation_type as string,
        metadata: includeMetadata ? parsedMetadata : null,
        checksum: row.checksum as string,
        previousChecksum: row.previous_checksum as string | undefined,
        changeNote: row.change_note as string | undefined,
        organizationId: row.organization_id as string | undefined,
        environmentId: row.env_id as string | undefined,
        recordedBy: row.recorded_by as string | undefined,
        recordedAt: row.recorded_at as string,
      };
    });

    return { records: result, total, hasMore };
  }

  /**
   * Perform a rollback: persist `restoredData` as the new current state and record a
   * single 'revert' history entry (instead of the usual 'update' entry that `save()`
   * would produce). This avoids the duplicate-version problem that arises when
   * `register()` → `save()` writes an 'update' entry followed by an additional
   * 'revert' entry for the same version number.
   */
  async registerRollback(
    type: string,
    name: string,
    restoredData: unknown,
    targetVersion: number,
    changeNote?: string,
    recordedBy?: string
  ): Promise<void> {
    await this.ensureSchema();

    const now = new Date().toISOString();
    const metadataJson = JSON.stringify(restoredData);
    const newChecksum = await calculateChecksum(restoredData);

    const existing = await this._findOne(this.tableName, {
      where: this.baseFilter(type, name),
    });

    if (!existing) {
      throw new Error(`Metadata ${type}/${name} not found for rollback`);
    }

    const previousChecksum = existing.checksum as string | undefined;
    const newVersion = ((existing.version as number) ?? 0) + 1;

    await this._update(this.tableName, existing.id as string, {
      metadata: metadataJson,
      version: newVersion,
      checksum: newChecksum,
      updated_at: now,
      state: 'active',
    });

    // Write exactly one 'revert' history entry (not an 'update' entry)
    await this.createHistoryRecord(
      existing.id as string,
      type,
      name,
      newVersion,
      restoredData,
      'revert',
      previousChecksum,
      changeNote ?? `Rolled back to version ${targetVersion}`,
      recordedBy
    );
  }

  async save(
    type: string,
    name: string,
    data: any,
    _options?: MetadataSaveOptions
  ): Promise<MetadataSaveResult> {
    const startTime = Date.now();

    await this.ensureSchema();

    const now = new Date().toISOString();
    const metadataJson = JSON.stringify(data);
    const newChecksum = await calculateChecksum(data);

    try {
      const existing = await this._findOne(this.tableName, {
        where: this.baseFilter(type, name),
      });

      if (existing) {
        // Skip update if the content is identical (prevents phantom version bumps)
        const previousChecksum = existing.checksum as string | undefined;
        if (newChecksum === previousChecksum) {
          return {
            success: true,
            path: `datasource://${this.tableName}/${type}/${name}`,
            size: metadataJson.length,
            saveTime: Date.now() - startTime,
          };
        }

        // Update existing record
        const version = ((existing.version as number) ?? 0) + 1;

        await this._update(this.tableName, existing.id as string, {
          metadata: metadataJson,
          version,
          checksum: newChecksum,
          updated_at: now,
          state: 'active',
        });

        // Create history record for update
        await this.createHistoryRecord(
          existing.id as string,
          type,
          name,
          version,
          data,
          'update',
          previousChecksum
        );

        // Project to type-specific table
        if (this.projector) {
          await this.projector.project(type, name, data);
        }

        return {
          success: true,
          path: `datasource://${this.tableName}/${type}/${name}`,
          size: metadataJson.length,
          saveTime: Date.now() - startTime,
        };
      } else {
        // Create new record
        const id = generateId();
        await this._create(this.tableName, {
          id,
          name,
          type,
          namespace: 'default',
          scope: (data as any)?.scope ?? 'platform',
          metadata: metadataJson,
          checksum: newChecksum,
          strategy: 'merge',
          state: 'active',
          version: 1,
          source: 'database',
          ...(this.organizationId ? { organization_id: this.organizationId } : {}),
          ...(this.environmentId !== undefined ? { env_id: this.environmentId } : { env_id: null }),
          created_at: now,
          updated_at: now,
        });

        // Create history record for creation
        await this.createHistoryRecord(
          id,
          type,
          name,
          1,
          data,
          'create'
        );

        // Project to type-specific table
        if (this.projector) {
          await this.projector.project(type, name, data);
        }

        return {
          success: true,
          path: `datasource://${this.tableName}/${type}/${name}`,
          size: metadataJson.length,
          saveTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      throw new Error(
        `DatabaseLoader save failed for ${type}/${name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Delete a metadata item from the database
   */
  async delete(type: string, name: string): Promise<void> {
    await this.ensureSchema();

    // Find the existing record to get its ID
    const existing = await this._findOne(this.tableName, {
      where: this.baseFilter(type, name),
    });

    if (!existing) {
      // Item doesn't exist, nothing to delete
      return;
    }

    // Delete from the main metadata table using the record's ID
    await this._delete(this.tableName, existing.id as string);

    // Delete projection from type-specific table
    if (this.projector) {
      await this.projector.deleteProjection(type, name);
    }
  }
}

/**
 * Generate a simple unique ID for metadata records.
 * Uses crypto.randomUUID when available, falls back to timestamp-based ID.
 */
function generateId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `meta_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

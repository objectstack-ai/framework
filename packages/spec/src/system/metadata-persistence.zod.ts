// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Metadata Scope Enum
 * Defines the lifecycle and mutability of a metadata item.
 */
export const MetadataScopeSchema = z.enum([
  'system',   // Defined in Code (Files). Read-only at runtime. Upgraded via deployment.
  'platform', // Defined in DB (Global). admin-configured. Overrides system.
  'user',     // Defined in DB (Personal). User-configured. Overrides platform/system.
]);

/**
 * Metadata Lifecycle State
 */
export const MetadataStateSchema = z.enum([
  'draft',    // Work in progress, not active
  'active',   // Live and running
  'archived', // Soft deleted
  'deprecated' // Running but flagged for removal
]);

/**
 * Unified Metadata Persistence Protocol
 * 
 * Defines the standardized envelope for storing ANY metadata item (Object, View, Flow)
 * in the database (e.g. `_framework_metadata` or generic `metadata` table).
 * 
 * This treats "Metadata as Data".
 */
export const MetadataRecordSchema = z.object({
  /** Primary Key (UUID) */
  id: z.string(),
  
  /** 
   * Machine Name 
   * The unique identifier used in code references (e.g. "account_list_view").
   */
  name: z.string(),
  
  /**
   * Metadata Type
   * e.g. "object", "view", "permission_set", "flow"
   */
  type: z.string(),
  
  /**
   * Namespace / Module
   * Groups metadata into packages (e.g. "crm", "finance", "core").
   */
  namespace: z.string().default('default'),

  /**
   * Package Ownership Reference
   * Links this metadata record to the package that delivered it.
   * When set, the record is "managed" by the package and should not be
   * directly edited — customizations go through the overlay system.
   * Null/undefined means the record was created independently (not from a package).
   */
  packageId: z.string().optional().describe('Package ID that owns/delivered this metadata'),

  /**
   * Managed By Indicator
   * Determines who controls this metadata record's lifecycle.
   * - "package": Delivered and upgraded by a plugin package (read-only base)
   * - "platform": Created by platform admin via UI
   * - "user": Created by end user
   */
  managedBy: z.enum(['package', 'platform', 'user']).optional()
    .describe('Who manages this metadata record lifecycle'),
  
  /**
   * Ownership differentiation
   */
  scope: MetadataScopeSchema.default('platform'),
  
  /**
   * The Payload
   * Stores the actual configuration JSON.
   * This field holds the value of `ViewSchema`, `ObjectSchema`, etc.
   */
  metadata: z.record(z.string(), z.unknown()),

  /**
   * Extension / Merge Strategy
   * If this record overrides a system record, how should it be applied?
   */
  extends: z.string().optional().describe('Name of the parent metadata to extend/override'),
  strategy: z.enum(['merge', 'replace']).default('merge'),

  /** Owner (for user-scope items) */
  owner: z.string().optional(),
  
  /** State */
  state: MetadataStateSchema.default('active'),

  /** Tenant ID for multi-tenant isolation */
  tenantId: z.string().optional().describe('Tenant identifier for multi-tenant isolation'),

  /** Version number for optimistic concurrency */
  version: z.number().default(1).describe('Record version for optimistic concurrency control'),

  /** Checksum for change detection */
  checksum: z.string().optional().describe('Content checksum for change detection'),

  /** Source origin marker */
  source: z.enum(['filesystem', 'database', 'api', 'migration']).optional().describe('Origin of this metadata record'),

  /** Classification tags */
  tags: z.array(z.string()).optional().describe('Classification tags for filtering and grouping'),
  
  /** Package Publishing */
  publishedDefinition: z.unknown().optional()
    .describe('Snapshot of the last published definition'),
  publishedAt: z.string().datetime().optional()
    .describe('When this metadata was last published'),
  publishedBy: z.string().optional()
    .describe('Who published this version'),

  /** Audit */
  createdBy: z.string().optional(),
  createdAt: z.string().datetime().optional().describe('Creation timestamp'),
  updatedBy: z.string().optional(),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

export type MetadataRecord = z.infer<typeof MetadataRecordSchema>;
export type MetadataScope = z.infer<typeof MetadataScopeSchema>;

/**
 * Package Publish Result
 * Returned by `publishPackage()` after a package-level metadata publish operation.
 */
export const PackagePublishResultSchema = z.object({
  success: z.boolean().describe('Whether the publish succeeded'),
  packageId: z.string().describe('The package ID that was published'),
  version: z.number().int().describe('New version number after publish'),
  publishedAt: z.string().datetime().describe('Publish timestamp'),
  itemsPublished: z.number().int().describe('Total metadata items published'),
  validationErrors: z.array(z.object({
    type: z.string().describe('Metadata type that failed validation'),
    name: z.string().describe('Item name that failed validation'),
    message: z.string().describe('Validation error message'),
  })).optional().describe('Validation errors if publish failed'),
});

export type PackagePublishResult = z.infer<typeof PackagePublishResultSchema>;

/**
 * Metadata Format
 * Supported file formats for metadata serialization.
 */
export const MetadataFormatSchema = z.enum([
  'json', 'yaml', 'yml', 'ts', 'js',
  'typescript', 'javascript' // Aliases
]);

/**
 * Metadata Stats
 * Statistics about a metadata item.
 */
export const MetadataStatsSchema = z.object({
  path: z.string().optional(),
  size: z.number().optional(),
  mtime: z.string().datetime().optional(),
  hash: z.string().optional(),
  etag: z.string().optional(), // Required by local cache
  modifiedAt: z.string().datetime().optional(), // Alias for mtime
  format: MetadataFormatSchema.optional(), // Required for serialization
});

/**
 * Metadata Loader Contract
 * Describes the capabilities and identity of a metadata loader.
 */
export const MetadataLoaderContractSchema = z.object({
  name: z.string(),
  protocol: z.enum(['file:', 'http:', 's3:', 'datasource:', 'memory:']).describe('Loader protocol identifier'),
  description: z.string().optional(),
  supportedFormats: z.array(z.string()).optional(),
  supportsWatch: z.boolean().optional(),
  supportsWrite: z.boolean().optional(),
  supportsCache: z.boolean().optional(),
  capabilities: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(false),
    watch: z.boolean().default(false),
    list: z.boolean().default(true),
  }),
});

/**
 * Metadata Load Options
 */
export const MetadataLoadOptionsSchema = z.object({
  scope: MetadataScopeSchema.optional(),
  namespace: z.string().optional(),
  raw: z.boolean().optional().describe('Return raw file content instead of parsed JSON'),
  cache: z.boolean().optional(),
  useCache: z.boolean().optional(), // Alias for cache
  validate: z.boolean().optional(),
  ifNoneMatch: z.string().optional(), // For caching
  recursive: z.boolean().optional(),
  limit: z.number().optional(),
  patterns: z.array(z.string()).optional(),
  loader: z.string().optional().describe('Specific loader to use (e.g. filesystem, database)'),
});

/**
 * Metadata Load Result
 */
export const MetadataLoadResultSchema = z.object({
  data: z.unknown(),
  stats: MetadataStatsSchema.optional(),
  format: MetadataFormatSchema.optional(),
  source: z.string().optional(), // File path or URL
  fromCache: z.boolean().optional(),
  etag: z.string().optional(),
  notModified: z.boolean().optional(),
  loadTime: z.number().optional(),
});

/**
 * Metadata Save Options
 */
export const MetadataSaveOptionsSchema = z.object({
  format: MetadataFormatSchema.optional(),
  create: z.boolean().default(true),
  overwrite: z.boolean().default(true),
  path: z.string().optional(),
  prettify: z.boolean().optional(),
  indent: z.number().optional(),
  sortKeys: z.boolean().optional(),
  backup: z.boolean().optional(),
  atomic: z.boolean().optional(),
  loader: z.string().optional().describe('Specific loader to use (e.g. filesystem, database)'),
});

/**
 * Metadata Save Result
 */
export const MetadataSaveResultSchema = z.object({
  success: z.boolean(),
  path: z.string().optional(),
  stats: MetadataStatsSchema.optional(),
  etag: z.string().optional(),
  size: z.number().optional(),
  saveTime: z.number().optional(),
  backupPath: z.string().optional(),
});

/**
 * Metadata Watch Event
 */
export const MetadataWatchEventSchema = z.object({
  type: z.enum(['add', 'change', 'unlink', 'added', 'changed', 'deleted']),
  path: z.string(),
  name: z.string().optional(),
  stats: MetadataStatsSchema.optional(),
  metadataType: z.string().optional(),
  data: z.unknown().optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * Metadata Collection Info
 */
export const MetadataCollectionInfoSchema = z.object({
  type: z.string(),
  count: z.number(),
  namespaces: z.array(z.string()),
});

/**
 * Metadata Export/Import Options
 */
export const MetadataExportOptionsSchema = z.object({
  types: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional(),
  output: z.string().describe('Output directory or file'),
  format: MetadataFormatSchema.default('json'),
});

export const MetadataImportOptionsSchema = z.object({
  source: z.string().describe('Input directory or file'),
  strategy: z.enum(['merge', 'replace', 'skip']).default('merge'),
  validate: z.boolean().default(true),
});

/**
 * Metadata Fallback Strategy
 * Determines behavior when the primary datasource is unavailable.
 */
export const MetadataFallbackStrategySchema = z.enum([
  'filesystem', // Fall back to filesystem-based loading
  'memory',     // Fall back to in-memory storage
  'none',       // No fallback — fail immediately
]);

/**
 * Metadata Source Origin
 * Indicates where a metadata record was loaded from.
 */
export const MetadataSourceSchema = z.enum([
  'filesystem', // Loaded from local files
  'database',   // Loaded from database via datasource
  'api',        // Loaded from remote API
  'migration',  // Created during a migration process
]);

/**
 * Metadata Manager Config
 * 
 * Unified configuration for the MetadataManager.
 * Supports datasource-backed persistence via `datasource` field,
 * which references a DatasourceSchema.name resolved at runtime.
 */
export const MetadataManagerConfigSchema = z.object({
  /**
   * Datasource Name Reference
   * References a DatasourceSchema.name (e.g. 'default').
   * At runtime, resolved from kernel service `driver.{name}` to obtain the actual driver.
   * When provided, metadata is persisted to a database table.
   */
  datasource: z.string().optional().describe('Datasource name reference for database persistence'),

  /**
   * Metadata Table Name
   * The database table used for metadata storage when datasource is configured.
   */
  tableName: z.string().default('sys_metadata').describe('Database table name for metadata storage'),

  /**
   * Fallback Strategy
   * Determines behavior when the primary datasource is unavailable.
   */
  fallback: MetadataFallbackStrategySchema.default('none').describe('Fallback strategy when datasource is unavailable'),

  /**
   * Root directory for metadata (for filesystem loaders)
   */
  rootDir: z.string().optional().describe('Root directory for filesystem-based metadata'),

  /**
   * Enabled serialization formats
   */
  formats: z.array(MetadataFormatSchema).optional().describe('Enabled metadata formats'),

  /**
   * Enable file watching
   */
  watch: z.boolean().optional().describe('Enable file watching for filesystem loaders'),

  /**
   * Cache configuration
   */
  cache: z.boolean().optional().describe('Enable metadata caching'),

  /**
   * Watch options
   */
  watchOptions: z.object({
    ignored: z.array(z.string()).optional().describe('Patterns to ignore'),
    persistent: z.boolean().default(true).describe('Keep process running'),
  }).optional().describe('File watcher options'),
});

export type MetadataFormat = z.infer<typeof MetadataFormatSchema>;
export type MetadataStats = z.infer<typeof MetadataStatsSchema>;
export type MetadataLoaderContract = z.input<typeof MetadataLoaderContractSchema>;
export type MetadataLoadOptions = z.infer<typeof MetadataLoadOptionsSchema>;
export type MetadataLoadResult = z.infer<typeof MetadataLoadResultSchema>;
export type MetadataSaveOptions = z.infer<typeof MetadataSaveOptionsSchema>;
export type MetadataSaveResult = z.infer<typeof MetadataSaveResultSchema>;
export type MetadataWatchEvent = z.infer<typeof MetadataWatchEventSchema>;
export type MetadataCollectionInfo = z.infer<typeof MetadataCollectionInfoSchema>;
export type MetadataExportOptions = z.infer<typeof MetadataExportOptionsSchema>;
export type MetadataImportOptions = z.infer<typeof MetadataImportOptionsSchema>;
export type MetadataManagerConfig = z.input<typeof MetadataManagerConfigSchema>;
export type MetadataFallbackStrategy = z.infer<typeof MetadataFallbackStrategySchema>;
export type MetadataSource = z.infer<typeof MetadataSourceSchema>;

/**
 * Metadata History Record
 *
 * Represents a single version snapshot in the metadata change history.
 * Stored in the sys_metadata_history table for version tracking and rollback.
 */
export const MetadataHistoryRecordSchema = z.object({
  /** Primary Key (UUID) */
  id: z.string(),

  /** Reference to the parent metadata record ID */
  metadataId: z.string().describe('Foreign key to sys_metadata.id'),

  /**
   * Machine Name
   * Denormalized from parent for easier querying.
   */
  name: z.string(),

  /**
   * Metadata Type
   * Denormalized from parent for easier querying.
   */
  type: z.string(),

  /**
   * Version Number
   * Snapshot of the metadata version at this point in history.
   */
  version: z.number().describe('Version number at this snapshot'),

  /**
   * Operation Type
   * Indicates what kind of change triggered this history record.
   */
  operationType: z.enum(['create', 'update', 'publish', 'revert', 'delete']).describe('Type of operation that created this history entry'),

  /**
   * Historical Metadata Snapshot
   * Full JSON payload of the metadata definition at this version.
   */
  metadata: z.record(z.string(), z.unknown()).describe('Snapshot of metadata definition at this version'),

  /**
   * Content Checksum
   * SHA-256 checksum of the normalized metadata JSON for change detection.
   */
  checksum: z.string().describe('SHA-256 checksum of metadata content'),

  /**
   * Previous Checksum
   * Checksum of the previous version for diff optimization.
   */
  previousChecksum: z.string().optional().describe('Checksum of the previous version'),

  /**
   * Change Note
   * Human-readable description of what changed in this version.
   */
  changeNote: z.string().optional().describe('Description of changes made in this version'),

  /** Tenant ID for multi-tenant isolation */
  tenantId: z.string().optional().describe('Tenant identifier for multi-tenant isolation'),

  /** Audit: who made this change */
  recordedBy: z.string().optional().describe('User who made this change'),

  /** Audit: when was this version recorded */
  recordedAt: z.string().datetime().describe('Timestamp when this version was recorded'),
});

export type MetadataHistoryRecord = z.infer<typeof MetadataHistoryRecordSchema>;

/**
 * Metadata History Query Options
 * Options for retrieving metadata version history.
 */
export const MetadataHistoryQueryOptionsSchema = z.object({
  /** Limit number of history records returned */
  limit: z.number().int().positive().optional().describe('Maximum number of history records to return'),

  /** Offset for pagination */
  offset: z.number().int().nonnegative().optional().describe('Number of records to skip'),

  /** Only return versions after this timestamp */
  since: z.string().datetime().optional().describe('Only return history after this timestamp'),

  /** Only return versions before this timestamp */
  until: z.string().datetime().optional().describe('Only return history before this timestamp'),

  /** Filter by operation type */
  operationType: z.enum(['create', 'update', 'publish', 'revert', 'delete']).optional().describe('Filter by operation type'),

  /** Include full metadata payload in results (default: true) */
  includeMetadata: z.boolean().optional().default(true).describe('Include full metadata payload'),
});

export type MetadataHistoryQueryOptions = z.infer<typeof MetadataHistoryQueryOptionsSchema>;

/**
 * Metadata History Query Result
 * Result of querying metadata version history.
 */
export const MetadataHistoryQueryResultSchema = z.object({
  /** Array of history records */
  records: z.array(MetadataHistoryRecordSchema),

  /** Total number of history records (for pagination) */
  total: z.number().int().nonnegative(),

  /** Whether there are more records available */
  hasMore: z.boolean(),
});

export type MetadataHistoryQueryResult = z.infer<typeof MetadataHistoryQueryResultSchema>;

/**
 * Metadata Diff Result
 * Result of comparing two versions of metadata.
 */
export const MetadataDiffResultSchema = z.object({
  /** Metadata type */
  type: z.string(),

  /** Metadata name */
  name: z.string(),

  /** Version 1 (older) */
  version1: z.number(),

  /** Version 2 (newer) */
  version2: z.number(),

  /** Checksum of version 1 */
  checksum1: z.string(),

  /** Checksum of version 2 */
  checksum2: z.string(),

  /** Whether the versions are identical */
  identical: z.boolean(),

  /** JSON patch operations to transform v1 into v2 */
  patch: z.array(z.unknown()).optional().describe('JSON patch operations'),

  /** Human-readable diff summary */
  summary: z.string().optional().describe('Human-readable summary of changes'),
});

export type MetadataDiffResult = z.infer<typeof MetadataDiffResultSchema>;

/**
 * Metadata History Retention Policy
 * Configuration for automatic cleanup of old history records.
 */
export const MetadataHistoryRetentionPolicySchema = z.object({
  /** Maximum number of versions to keep per metadata item */
  maxVersions: z.number().int().positive().optional().describe('Maximum number of versions to retain'),

  /** Maximum age of history records in days */
  maxAgeDays: z.number().int().positive().optional().describe('Maximum age of history records in days'),

  /** Whether to enable automatic cleanup */
  autoCleanup: z.boolean().default(false).describe('Enable automatic cleanup of old history'),

  /** Cleanup interval in hours */
  cleanupIntervalHours: z.number().int().positive().default(24).describe('How often to run cleanup (in hours)'),
});

export type MetadataHistoryRetentionPolicy = z.infer<typeof MetadataHistoryRetentionPolicySchema>;

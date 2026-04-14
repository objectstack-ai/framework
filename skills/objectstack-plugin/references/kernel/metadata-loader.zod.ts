// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * # Metadata Loader Protocol
 * 
 * Defines the standard interface for loading and saving metadata in ObjectStack.
 * This protocol enables consistent metadata operations across different storage backends
 * (filesystem, HTTP, S3, databases) and serialization formats (JSON, YAML, TypeScript).
 */

/**
 * Metadata Format Enum
 * Supported serialization formats for metadata
 */
export const MetadataFormatSchema = z.enum(['json', 'yaml', 'typescript', 'javascript']);

/**
 * Metadata Statistics
 * Information about a metadata item without loading its full content
 */
export const MetadataStatsSchema = z.object({
  /**
   * Size of the metadata file in bytes
   */
  size: z.number().int().min(0).describe('File size in bytes'),
  
  /**
   * Last modification timestamp
   */
  modifiedAt: z.string().datetime().describe('Last modified date'),
  
  /**
   * ETag for cache validation
   * Used for conditional requests (If-None-Match header)
   */
  etag: z.string().describe('Entity tag for cache validation'),
  
  /**
   * Serialization format
   */
  format: MetadataFormatSchema.describe('Serialization format'),
  
  /**
   * Full file path (if applicable)
   */
  path: z.string().optional().describe('File system path'),
  
  /**
   * Additional metadata provider-specific properties
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Provider-specific metadata'),
});

/**
 * Metadata Load Options
 */
export const MetadataLoadOptionsSchema = z.object({
  /**
   * Glob patterns to match files
   * Example: ["**\/*.object.ts", "**\/*.object.json"]
   */
  patterns: z.array(z.string()).optional().describe('File glob patterns'),
  
  /**
   * If-None-Match header for conditional loading
   * Only load if ETag doesn't match
   */
  ifNoneMatch: z.string().optional().describe('ETag for conditional request'),
  
  /**
   * If-Modified-Since header for conditional loading
   */
  ifModifiedSince: z.string().datetime().optional().describe('Only load if modified after this date'),
  
  /**
   * Whether to validate against Zod schema
   */
  validate: z.boolean().default(true).describe('Validate against schema'),
  
  /**
   * Whether to use cache if available
   */
  useCache: z.boolean().default(true).describe('Enable caching'),
  
  /**
   * Filter function (serialized as string)
   * Example: "(item) => item.name.startsWith('sys_')"
   */
  filter: z.string().optional().describe('Filter predicate as string'),
  
  /**
   * Maximum number of items to load
   */
  limit: z.number().int().min(1).optional().describe('Maximum items to load'),
  
  /**
   * Recursively search subdirectories
   */
  recursive: z.boolean().default(true).describe('Search subdirectories'),
});

/**
 * Metadata Save Options
 */
export const MetadataSaveOptionsSchema = z.object({
  /**
   * Serialization format
   */
  format: MetadataFormatSchema.default('typescript').describe('Output format'),
  
  /**
   * Prettify output (formatted with indentation)
   */
  prettify: z.boolean().default(true).describe('Format with indentation'),
  
  /**
   * Indentation size (spaces)
   */
  indent: z.number().int().min(0).max(8).default(2).describe('Indentation spaces'),
  
  /**
   * Sort object keys alphabetically
   */
  sortKeys: z.boolean().default(false).describe('Sort object keys'),
  
  /**
   * Include default values in output
   */
  includeDefaults: z.boolean().default(false).describe('Include default values'),
  
  /**
   * Create backup before overwriting
   */
  backup: z.boolean().default(false).describe('Create backup file'),
  
  /**
   * Overwrite if exists
   */
  overwrite: z.boolean().default(true).describe('Overwrite existing file'),
  
  /**
   * Atomic write (write to temp file, then rename)
   */
  atomic: z.boolean().default(true).describe('Use atomic write operation'),
  
  /**
   * Custom file path (overrides default location)
   */
  path: z.string().optional().describe('Custom output path'),
});

/**
 * Metadata Export Options
 */
export const MetadataExportOptionsSchema = z.object({
  /**
   * Output file path
   */
  output: z.string().describe('Output file path'),
  
  /**
   * Export format
   */
  format: MetadataFormatSchema.default('json').describe('Export format'),
  
  /**
   * Filter predicate as string
   */
  filter: z.string().optional().describe('Filter items to export'),
  
  /**
   * Include statistics in export
   */
  includeStats: z.boolean().default(false).describe('Include metadata statistics'),
  
  /**
   * Compress output
   */
  compress: z.boolean().default(false).describe('Compress output (gzip)'),
  
  /**
   * Pretty print output
   */
  prettify: z.boolean().default(true).describe('Pretty print output'),
});

/**
 * Metadata Import Options
 */
export const MetadataImportOptionsSchema = z.object({
  /**
   * Conflict resolution strategy
   */
  conflictResolution: z.enum(['skip', 'overwrite', 'merge', 'fail'])
    .default('merge')
    .describe('How to handle existing items'),
  
  /**
   * Validate items against schema
   */
  validate: z.boolean().default(true).describe('Validate before import'),
  
  /**
   * Dry run (don't actually save)
   */
  dryRun: z.boolean().default(false).describe('Simulate import without saving'),
  
  /**
   * Continue on errors
   */
  continueOnError: z.boolean().default(false).describe('Continue if validation fails'),
  
  /**
   * Transform function (as string)
   * Example: "(item) => ({ ...item, imported: true })"
   */
  transform: z.string().optional().describe('Transform items before import'),
});

/**
 * Metadata Loader Result
 * Result of a metadata load operation
 */
export const MetadataLoadResultSchema = z.object({
  /**
   * Loaded data
   */
  data: z.unknown().nullable().describe('Loaded metadata'),
  
  /**
   * Whether data came from cache (304 Not Modified)
   */
  fromCache: z.boolean().default(false).describe('Loaded from cache'),
  
  /**
   * Not modified (conditional request matched)
   */
  notModified: z.boolean().default(false).describe('Not modified since last request'),
  
  /**
   * ETag of loaded data
   */
  etag: z.string().optional().describe('Entity tag'),
  
  /**
   * Statistics about loaded data
   */
  stats: MetadataStatsSchema.optional().describe('Metadata statistics'),
  
  /**
   * Load time in milliseconds
   */
  loadTime: z.number().min(0).optional().describe('Load duration in ms'),
});

/**
 * Metadata Save Result
 */
export const MetadataSaveResultSchema = z.object({
  /**
   * Whether save was successful
   */
  success: z.boolean().describe('Save successful'),
  
  /**
   * Path where file was saved
   */
  path: z.string().describe('Output path'),
  
  /**
   * Generated ETag
   */
  etag: z.string().optional().describe('Generated entity tag'),
  
  /**
   * File size in bytes
   */
  size: z.number().int().min(0).optional().describe('File size'),
  
  /**
   * Save time in milliseconds
   */
  saveTime: z.number().min(0).optional().describe('Save duration in ms'),
  
  /**
   * Backup path (if created)
   */
  backupPath: z.string().optional().describe('Backup file path'),
});

/**
 * Metadata Watch Event
 */
export const MetadataWatchEventSchema = z.object({
  /**
   * Event type
   */
  type: z.enum(['added', 'changed', 'deleted']).describe('Event type'),
  
  /**
   * Metadata type (e.g., 'object', 'view', 'app')
   */
  metadataType: z.string().describe('Type of metadata'),
  
  /**
   * Item name/identifier
   */
  name: z.string().describe('Item identifier'),
  
  /**
   * Full file path
   */
  path: z.string().describe('File path'),
  
  /**
   * Loaded item data (for added/changed events)
   */
  data: z.unknown().optional().describe('Item data'),
  
  /**
   * Timestamp
   */
  timestamp: z.string().datetime().describe('Event timestamp'),
});

/**
 * Metadata Collection Info
 * Summary of a metadata collection
 */
export const MetadataCollectionInfoSchema = z.object({
  /**
   * Collection type (e.g., 'object', 'view', 'app')
   */
  type: z.string().describe('Collection type'),
  
  /**
   * Total items in collection
   */
  count: z.number().int().min(0).describe('Number of items'),
  
  /**
   * Formats found in collection
   */
  formats: z.array(MetadataFormatSchema).describe('Formats in collection'),
  
  /**
   * Total size in bytes
   */
  totalSize: z.number().int().min(0).optional().describe('Total size in bytes'),
  
  /**
   * Last modified timestamp
   */
  lastModified: z.string().datetime().optional().describe('Last modification date'),
  
  /**
   * Collection location (path or URL)
   */
  location: z.string().optional().describe('Collection location'),
});

/**
 * Metadata Loader Interface Contract
 * Defines the standard methods all metadata loaders must implement
 */
export const MetadataLoaderContractSchema = z.object({
  /**
   * Loader name/identifier
   */
  name: z.string().describe('Loader identifier'),

  /**
   * Protocol handled by this loader (e.g. 'file:', 'http:', 's3:', 'datasource:')
   */
  protocol: z.enum(['file:', 'http:', 's3:', 'datasource:', 'memory:']).describe('Protocol identifier'),

  /**
   * Detailed capabilities
   */
  capabilities: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(false),
    watch: z.boolean().default(false),
    list: z.boolean().default(true),
  }).describe('Loader capabilities'),
  
  /**
   * Supported formats
   */
  supportedFormats: z.array(MetadataFormatSchema).describe('Supported formats'),
  
  /**
   * Whether loader supports watching for changes
   */
  supportsWatch: z.boolean().default(false).describe('Supports file watching'),
  
  /**
   * Whether loader supports saving
   */
  supportsWrite: z.boolean().default(true).describe('Supports write operations'),
  
  /**
   * Whether loader supports caching
   */
  supportsCache: z.boolean().default(true).describe('Supports caching'),
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
 * Metadata Manager Configuration
 */
export const MetadataManagerConfigSchema = z.object({
  /**
   * Datasource Name Reference
   * References a DatasourceSchema.name (e.g. 'default').
   * At runtime, resolved from kernel service `driver.{name}` to obtain the actual driver.
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
  rootDir: z.string().optional().describe('Root directory path'),
  
  /**
   * Enabled serialization formats
   */
  formats: z.array(MetadataFormatSchema).default(['typescript', 'json', 'yaml']).describe('Enabled formats'),
  
  /**
   * Cache configuration
   */
  cache: z.object({
    enabled: z.boolean().default(true).describe('Enable caching'),
    ttl: z.number().int().min(0).default(3600).describe('Cache TTL in seconds'),
    maxSize: z.number().int().min(0).optional().describe('Max cache size in bytes'),
  }).optional().describe('Cache settings'),
  
  /**
   * Watch for file changes
   */
  watch: z.boolean().default(false).describe('Enable file watching'),
  
  /**
   * Watch options
   */
  watchOptions: z.object({
    ignored: z.array(z.string()).optional().describe('Patterns to ignore'),
    persistent: z.boolean().default(true).describe('Keep process running'),
    ignoreInitial: z.boolean().default(true).describe('Ignore initial add events'),
  }).optional().describe('File watcher options'),
  
  /**
   * Validation settings
   */
  validation: z.object({
    strict: z.boolean().default(true).describe('Strict validation'),
    throwOnError: z.boolean().default(true).describe('Throw on validation error'),
  }).optional().describe('Validation settings'),
  
  /**
   * Loader-specific options
   */
  loaderOptions: z.record(z.string(), z.unknown()).optional().describe('Loader-specific configuration'),
});

// Export types
export type MetadataFormat = z.infer<typeof MetadataFormatSchema>;
export type MetadataStats = z.infer<typeof MetadataStatsSchema>;
export type MetadataLoadOptions = z.input<typeof MetadataLoadOptionsSchema>;
export type MetadataSaveOptions = z.infer<typeof MetadataSaveOptionsSchema>;
export type MetadataExportOptions = z.infer<typeof MetadataExportOptionsSchema>;
export type MetadataImportOptions = z.infer<typeof MetadataImportOptionsSchema>;
export type MetadataLoadResult = z.infer<typeof MetadataLoadResultSchema>;
export type MetadataSaveResult = z.infer<typeof MetadataSaveResultSchema>;
export type MetadataWatchEvent = z.infer<typeof MetadataWatchEventSchema>;
export type MetadataCollectionInfo = z.infer<typeof MetadataCollectionInfoSchema>;
export type MetadataLoaderContract = z.input<typeof MetadataLoaderContractSchema>;
export type MetadataManagerConfig = z.input<typeof MetadataManagerConfigSchema>;
export type MetadataFallbackStrategy = z.infer<typeof MetadataFallbackStrategySchema>;

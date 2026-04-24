// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FieldMappingSchema } from '../shared/mapping.zod';

/**
 * Data Sync Protocol - LEVEL 1: Simple Synchronization
 * 
 * Inspired by Salesforce Connect, Segment Sync, and Census Reverse ETL.
 * 
 * **Positioning in 3-Layer Architecture:**
 * - **L1: Simple Sync** (THIS FILE) - Business users - Sync Salesforce to Sheets
 * - **L2: ETL Pipeline** (automation/etl.zod.ts) - Data engineers - Aggregate 10 sources to warehouse
 * - **L3: Enterprise Connector** (integration/connector.zod.ts) - System integrators - Full SAP integration
 * 
 * Data sync provides bidirectional or unidirectional data synchronization
 * between ObjectStack and external systems, maintaining data consistency
 * across platforms.
 * 
 * **SCOPE: Simple field mappings only. NO complex transformations.**
 * For complex transformations (joins, aggregates, custom SQL), use ETL Pipeline (Level 2).
 * 
 * ## When to Use This Layer
 * 
 * **Use Simple Sync when:**
 * - Syncing 1:1 fields between two systems
 * - Simple field transformations (uppercase, cast, etc.)
 * - No complex logic required
 * - Business users need to configure integrations
 * 
 * **Examples:**
 * - Salesforce Contact ↔ Google Sheets
 * - HubSpot Company ↔ CRM Account
 * - Shopify Orders → Accounting System
 * 
 * **When to upgrade:**
 * - Need multi-source joins → Use {@link file://./etl.zod.ts | ETL Pipeline}
 * - Need complex authentication/webhooks → Use {@link file://../integration/connector.zod.ts | Enterprise Connector}
 * - Need aggregations or data warehousing → Use {@link file://./etl.zod.ts | ETL Pipeline}
 * 
 * @see {@link file://./etl.zod.ts} for Level 2 (data engineering)
 * @see {@link file://../integration/connector.zod.ts} for Level 3 (enterprise integration)
 * 
 * ## Use Cases
 * 
 * 1. **CRM Integration**
 *    - Sync contacts between ObjectStack and Salesforce
 *    - Keep opportunity data synchronized
 *    - Bidirectional updates
 * 
 * 2. **Customer Data Platform (CDP)**
 *    - Sync user profiles to Segment
 *    - Enrichment data from Clearbit
 *    - Marketing automation sync
 * 
 * 3. **Operational Analytics**
 *    - Sync production data to analytics warehouse
 *    - Real-time dashboards
 *    - Business intelligence
 * 
 * @see https://help.salesforce.com/s/articleView?id=sf.platform_connect_about.htm
 * @see https://segment.com/docs/connections/sync/
 * @see https://www.getcensus.com/
 * 
 * @example
 * ```typescript
 * const contactSync: DataSyncConfig = {
 *   name: 'salesforce_contact_sync',
 *   label: 'Salesforce Contact Sync',
 *   source: {
 *     object: 'contact',
 *     filters: { status: 'active' }
 *   },
 *   destination: {
 *     connector: 'salesforce',
 *     operation: 'upsert_contact',
 *     mapping: {
 *       first_name: 'FirstName',
 *       last_name: 'LastName',
 *       email: 'Email'
 *     }
 *   },
 *   syncMode: 'incremental',
 *   schedule: '0 * * * *' // Hourly
 * }
 * ```
 */

/**
 * Sync Direction
 */
import { lazySchema } from '../shared/lazy-schema';
export const SyncDirectionSchema = lazySchema(() => z.enum([
  'push',        // ObjectStack -> External (one-way)
  'pull',        // External -> ObjectStack (one-way)
  'bidirectional', // Both directions
]));

export type SyncDirection = z.infer<typeof SyncDirectionSchema>;

/**
 * Sync Mode
 */
export const SyncModeSchema = lazySchema(() => z.enum([
  'full',        // Full refresh every time
  'incremental', // Only sync changed records
  'realtime',    // Real-time streaming sync
]));

export type SyncMode = z.infer<typeof SyncModeSchema>;

/**
 * Conflict Resolution Strategy
 */
export const ConflictResolutionSchema = lazySchema(() => z.enum([
  'source_wins',      // Source system always wins
  'destination_wins', // Destination system always wins
  'latest_wins',      // Most recently modified wins
  'manual',           // Flag for manual resolution
  'merge',            // Smart merge (custom logic)
]));

export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

/**
 * Field Mapping for Data Sync
 * 
 * Uses the canonical field mapping protocol from shared/mapping.zod.ts
 * for simple 1:1 field transformations.
 * 
 * @see {@link FieldMappingSchema} for the base field mapping schema
 */

/**
 * Data Source Configuration
 */
export const DataSourceConfigSchema = lazySchema(() => z.object({
  /**
   * Source object name
   * For ObjectStack objects
   */
  object: z.string().optional().describe('ObjectStack object name'),

  /**
   * Filter conditions
   * Only sync records matching these filters
   */
  filters: z.unknown().optional().describe('Filter conditions'),

  /**
   * Fields to include
   * If not specified, all fields are synced
   */
  fields: z.array(z.string()).optional().describe('Fields to sync'),

  /**
   * External connector instance ID
   * For external data sources
   */
  connectorInstanceId: z.string().optional().describe('Connector instance ID'),

  /**
   * External resource identifier
   * e.g., Salesforce object name, database table, API endpoint
   */
  externalResource: z.string().optional().describe('External resource ID'),
}));

export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;

/**
 * Data Destination Configuration
 */
export const DataDestinationConfigSchema = lazySchema(() => z.object({
  /**
   * Destination object name
   * For ObjectStack objects
   */
  object: z.string().optional().describe('ObjectStack object name'),

  /**
   * Connector instance ID
   * For external destinations
   */
  connectorInstanceId: z.string().optional().describe('Connector instance ID'),

  /**
   * Operation to perform
   */
  operation: z.enum([
    'insert',      // Create new records only
    'update',      // Update existing records only
    'upsert',      // Insert or update based on key
    'delete',      // Delete records
    'sync',        // Full synchronization
  ]).describe('Sync operation'),

  /**
   * Field mappings
   * Maps source fields to destination fields
   */
  mapping: z.union([
    z.record(z.string(), z.string()),                    // Simple mapping: { sourceField: 'destField' }
    z.array(FieldMappingSchema),             // Advanced mapping with transformations
  ]).optional().describe('Field mappings'),

  /**
   * External resource identifier
   */
  externalResource: z.string().optional().describe('External resource ID'),

  /**
   * Match key for upsert operations
   * Fields to use for matching existing records
   */
  matchKey: z.array(z.string()).optional().describe('Match key fields'),
}));

export type DataDestinationConfig = z.infer<typeof DataDestinationConfigSchema>;

/**
 * Data Sync Configuration Schema
 * 
 * Complete definition of a data synchronization between systems.
 */
export const DataSyncConfigSchema = lazySchema(() => z.object({
  /**
   * Sync configuration name (snake_case)
   */
  name: z.string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .describe('Sync configuration name (snake_case)'),

  /**
   * Human-readable label
   */
  label: z.string().optional().describe('Sync display name'),

  /**
   * Description
   */
  description: z.string().optional().describe('Sync description'),

  /**
   * Source configuration
   */
  source: DataSourceConfigSchema.describe('Data source'),

  /**
   * Destination configuration
   */
  destination: DataDestinationConfigSchema.describe('Data destination'),

  /**
   * Sync direction
   */
  direction: SyncDirectionSchema.default('push').describe('Sync direction'),

  /**
   * Sync mode
   */
  syncMode: SyncModeSchema.default('incremental').describe('Sync mode'),

  /**
   * Conflict resolution strategy
   */
  conflictResolution: ConflictResolutionSchema
    .default('latest_wins')
    .describe('Conflict resolution'),

  /**
   * Execution schedule (cron expression)
   * For scheduled syncs
   * 
   * @example "0 * * * *" - Hourly
   * @example "*\/15 * * * *" - Every 15 minutes
   */
  schedule: z.string().optional().describe('Cron schedule'),

  /**
   * Whether sync is enabled
   */
  enabled: z.boolean().default(true).describe('Sync enabled'),

  /**
   * Change tracking field
   * Field to track when records were last modified
   * Used for incremental sync
   * 
   * @example "updated_at", "modified_date"
   */
  changeTrackingField: z.string()
    .optional()
    .describe('Field for change tracking'),

  /**
   * Batch size
   * Number of records to process per batch
   */
  batchSize: z.number().int().min(1).max(10000)
    .default(100)
    .describe('Batch size for processing'),

  /**
   * Retry configuration
   */
  retry: z.object({
    maxAttempts: z.number().int().min(0).default(3).describe('Max retries'),
    backoffMs: z.number().int().min(0).default(30000).describe('Backoff duration'),
  }).optional().describe('Retry configuration'),

  /**
   * Pre-sync validation rules
   */
  validation: z.object({
    required: z.array(z.string()).optional().describe('Required fields'),
    unique: z.array(z.string()).optional().describe('Unique constraint fields'),
    custom: z.array(z.object({
      name: z.string(),
      condition: z.string().describe('Validation condition'),
      message: z.string().describe('Error message'),
    })).optional().describe('Custom validation rules'),
  }).optional().describe('Validation rules'),

  /**
   * Error handling configuration
   */
  errorHandling: z.object({
    onValidationError: z.enum(['skip', 'fail', 'log']).default('skip'),
    onSyncError: z.enum(['skip', 'fail', 'retry']).default('retry'),
    notifyOnError: z.array(z.string()).optional().describe('Email notifications'),
  }).optional().describe('Error handling'),

  /**
   * Performance optimization
   */
  optimization: z.object({
    parallelBatches: z.boolean().default(false).describe('Process batches in parallel'),
    cacheEnabled: z.boolean().default(true).describe('Enable caching'),
    compressionEnabled: z.boolean().default(false).describe('Enable compression'),
  }).optional().describe('Performance optimization'),

  /**
   * Audit and logging
   */
  audit: z.object({
    logLevel: z.enum(['none', 'error', 'warn', 'info', 'debug']).default('info'),
    retainLogsForDays: z.number().int().min(1).default(30),
    trackChanges: z.boolean().default(true).describe('Track all changes'),
  }).optional().describe('Audit configuration'),

  /**
   * Tags for organization
   */
  tags: z.array(z.string()).optional().describe('Sync tags'),

  /**
   * Custom metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
}));

export type DataSyncConfig = z.infer<typeof DataSyncConfigSchema>;

/**
 * Sync Execution Status
 */
export const SyncExecutionStatusSchema = lazySchema(() => z.enum([
  'pending',      // Queued
  'running',      // Currently executing
  'completed',    // Successfully completed
  'partial',      // Completed with some errors
  'failed',       // Failed
  'cancelled',    // Manually cancelled
]));

export type SyncExecutionStatus = z.infer<typeof SyncExecutionStatusSchema>;

/**
 * Sync Execution Result Schema
 * 
 * Result of a sync execution.
 */
export const SyncExecutionResultSchema = lazySchema(() => z.object({
  /**
   * Execution ID
   */
  id: z.string().describe('Execution ID'),

  /**
   * Sync configuration name
   */
  syncName: z.string().describe('Sync name'),

  /**
   * Execution status
   */
  status: SyncExecutionStatusSchema.describe('Execution status'),

  /**
   * Start timestamp
   */
  startedAt: z.string().datetime().describe('Start time'),

  /**
   * End timestamp
   */
  completedAt: z.string().datetime().optional().describe('Completion time'),

  /**
   * Duration in milliseconds
   */
  durationMs: z.number().optional().describe('Duration in ms'),

  /**
   * Statistics
   */
  stats: z.object({
    recordsProcessed: z.number().int().default(0).describe('Total records processed'),
    recordsInserted: z.number().int().default(0).describe('Records inserted'),
    recordsUpdated: z.number().int().default(0).describe('Records updated'),
    recordsDeleted: z.number().int().default(0).describe('Records deleted'),
    recordsSkipped: z.number().int().default(0).describe('Records skipped'),
    recordsErrored: z.number().int().default(0).describe('Records with errors'),
    conflictsDetected: z.number().int().default(0).describe('Conflicts detected'),
    conflictsResolved: z.number().int().default(0).describe('Conflicts resolved'),
  }).optional().describe('Execution statistics'),

  /**
   * Errors encountered
   */
  errors: z.array(z.object({
    recordId: z.string().optional().describe('Record ID'),
    field: z.string().optional().describe('Field name'),
    message: z.string().describe('Error message'),
    code: z.string().optional().describe('Error code'),
  })).optional().describe('Errors'),

  /**
   * Execution logs
   */
  logs: z.array(z.string()).optional().describe('Execution logs'),
}));

export type SyncExecutionResult = z.infer<typeof SyncExecutionResultSchema>;

/**
 * Helper factory for creating sync configurations
 */
export const Sync = {
  /**
   * Create a simple object-to-object sync
   */
  objectSync: (params: {
    name: string;
    sourceObject: string;
    destObject: string;
    mapping: Record<string, string>;
    schedule?: string;
  }): DataSyncConfig => ({
    name: params.name,
    source: {
      object: params.sourceObject,
    },
    destination: {
      object: params.destObject,
      operation: 'upsert',
      mapping: params.mapping,
    },
    direction: 'push',
    syncMode: 'incremental',
    conflictResolution: 'latest_wins',
    batchSize: 100,
    schedule: params.schedule,
    enabled: true,
  }),

  /**
   * Create a connector sync
   */
  connectorSync: (params: {
    name: string;
    sourceObject: string;
    connectorInstanceId: string;
    externalResource: string;
    mapping: Record<string, string>;
    schedule?: string;
  }): DataSyncConfig => ({
    name: params.name,
    source: {
      object: params.sourceObject,
    },
    destination: {
      connectorInstanceId: params.connectorInstanceId,
      externalResource: params.externalResource,
      operation: 'upsert',
      mapping: params.mapping,
    },
    direction: 'push',
    syncMode: 'incremental',
    conflictResolution: 'latest_wins',
    batchSize: 100,
    schedule: params.schedule,
    enabled: true,
  }),

  /**
   * Create a bidirectional sync
   */
  bidirectionalSync: (params: {
    name: string;
    object: string;
    connectorInstanceId: string;
    externalResource: string;
    mapping: Record<string, string>;
    schedule?: string;
  }): DataSyncConfig => ({
    name: params.name,
    source: {
      object: params.object,
    },
    destination: {
      connectorInstanceId: params.connectorInstanceId,
      externalResource: params.externalResource,
      operation: 'sync',
      mapping: params.mapping,
    },
    direction: 'bidirectional',
    syncMode: 'incremental',
    conflictResolution: 'latest_wins',
    batchSize: 100,
    schedule: params.schedule,
    enabled: true,
  }),
} as const;

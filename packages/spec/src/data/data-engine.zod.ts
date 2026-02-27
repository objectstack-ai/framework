// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FilterConditionSchema } from './filter.zod';
import { SortNodeSchema } from './query.zod';
import { ExecutionContextSchema } from '../kernel/execution-context.zod';

/**
 * Data Engine Protocol
 * 
 * Defines the standard interface for data persistence engines in ObjectStack.
 * This protocol abstracts the underlying storage mechanism (SQL, NoSQL, API, Memory),
 * allowing the ObjectQL engine to execute standardized CRUD and Aggregation operations
 * regardless of where the data resides.
 * 
 * The Data Engine acts as the "Driver" layer in the Hexagonal Architecture.
 */

// ==========================================================================
// 1. Shared Definitions
// ==========================================================================

/**
 * Data Engine Query filter conditions
 * Supports simple key-value map or complex Logic/Field expressions (DSL)
 */
export const DataEngineFilterSchema = z.union([
  z.record(z.string(), z.unknown()),
  FilterConditionSchema
]).describe('Data Engine query filter conditions');

/**
 * Sort order definition
 * Supports:
 * - { name: 'asc' }
 * - { name: 1 }
 * - [{ field: 'name', order: 'asc' }]
 */
export const DataEngineSortSchema = z.union([
  z.record(z.string(), z.enum(['asc', 'desc'])), 
  z.record(z.string(), z.union([z.literal(1), z.literal(-1)])),
  z.array(SortNodeSchema)
]).describe('Sort order definition');

// ==========================================================================
// 1b. Base Engine Options (shared context)
// ==========================================================================

/**
 * Base Engine Options
 * 
 * All Data Engine operation options extend this schema to carry
 * an optional ExecutionContext for identity, tenant, and transaction propagation.
 */
export const BaseEngineOptionsSchema = z.object({
  /** Execution context (identity, tenant, transaction) */
  context: ExecutionContextSchema.optional(),
});

// ==========================================================================
// 2. method: FIND
// ==========================================================================

export const DataEngineQueryOptionsSchema = BaseEngineOptionsSchema.extend({
  /** Filter conditions (WHERE) */
  filter: DataEngineFilterSchema.optional(),
  
  /** Fields to select (SELECT) */
  select: z.array(z.string()).optional(),
  
  /** Sort order (ORDER BY) */
  sort: DataEngineSortSchema.optional(),
  
  /** Limit number of results (LIMIT) */
  limit: z.number().int().min(1).optional(),
  
  /** Skip number of results (OFFSET) */
  skip: z.number().int().min(0).optional(),
  
  /** 
   * Maximum number of results (OData style)
   * Takes precedence over limit if both specified
   */
  top: z.number().int().min(1).optional(),

  /**
   * Include related records ($expand / Populate)
   * 
   * List of relationship field names (lookup or master_detail) to expand.
   * The engine resolves these by batch-loading referenced records using $in
   * queries and replacing foreign key IDs with full objects in the result.
   * 
   * This is driver-agnostic — expand is handled at the engine layer via
   * secondary queries, not via SQL JOINs or driver-specific features.
   * Fields without a valid `reference` in the schema are silently skipped.
   */
  populate: z.array(z.string()).optional(),
}).describe('Query options for IDataEngine.find() operations');

// ==========================================================================
// 3. method: INSERT
// ==========================================================================

export const DataEngineInsertOptionsSchema = BaseEngineOptionsSchema.extend({
  /** 
   * Return the inserted record(s)? 
   * Some drivers support RETURNING clause for efficiency.
   * Default: true
   */
  returning: z.boolean().default(true).optional(),
}).describe('Options for DataEngine.insert operations');

// ==========================================================================
// 4. method: UPDATE
// ==========================================================================

export const DataEngineUpdateOptionsSchema = BaseEngineOptionsSchema.extend({
  /** Filter conditions to identify records to update */
  filter: DataEngineFilterSchema.optional(),
  
  /** 
   * Perform an upsert? 
   * If true, insert if not found.
   */
  upsert: z.boolean().default(false).optional(),
  
  /**
   * Update multiple records?
   * If false, only the first match is updated.
   * Default: false
   */
  multi: z.boolean().default(false).optional(),
  
  /** 
   * Return the updated record(s)? 
   * Default: false (returns update count/status)
   */
  returning: z.boolean().default(false).optional(),
}).describe('Options for DataEngine.update operations');

// ==========================================================================
// 5. method: DELETE
// ==========================================================================

export const DataEngineDeleteOptionsSchema = BaseEngineOptionsSchema.extend({
  /** Filter conditions to identify records to delete */
  filter: DataEngineFilterSchema.optional(),
  
  /**
   * Delete multiple records?
   * If false, only the first match is deleted.
   * Default: false
   */
  multi: z.boolean().default(false).optional(),
}).describe('Options for DataEngine.delete operations');

// ==========================================================================
// 6. method: AGGREGATE
// ==========================================================================

export const DataEngineAggregateOptionsSchema = BaseEngineOptionsSchema.extend({
  /** Filter conditions (WHERE) */
  filter: DataEngineFilterSchema.optional(),
  
  /** Group By fields */
  groupBy: z.array(z.string()).optional(),
  
  /** 
   * Aggregation definitions 
   * e.g. [{ field: 'amount', method: 'sum', alias: 'total' }]
   */
  aggregations: z.array(z.object({
    field: z.string(),
    method: z.enum(['count', 'sum', 'avg', 'min', 'max', 'count_distinct']),
    alias: z.string().optional()
  })).optional(),
}).describe('Options for DataEngine.aggregate operations');

// ==========================================================================
// 7. method: COUNT
// ==========================================================================

export const DataEngineCountOptionsSchema = BaseEngineOptionsSchema.extend({
  /** Filter conditions */
  filter: DataEngineFilterSchema.optional(),
}).describe('Options for DataEngine.count operations');

// ==========================================================================
// 8. Definition (Contract)
// ==========================================================================

export const DataEngineContractSchema = z.object({
  find: z.function()
    .input(z.tuple([z.string(), DataEngineQueryOptionsSchema.optional()]))
    .output(z.promise(z.array(z.unknown()))),
    
  findOne: z.function()
    .input(z.tuple([z.string(), DataEngineQueryOptionsSchema.optional()]))
    .output(z.promise(z.unknown())),
    
  insert: z.function()
    .input(z.tuple([z.string(), z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]), DataEngineInsertOptionsSchema.optional()]))
    .output(z.promise(z.unknown())),
    
  update: z.function()
    .input(z.tuple([z.string(), z.record(z.string(), z.unknown()), DataEngineUpdateOptionsSchema.optional()]))
    .output(z.promise(z.unknown())),
    
  delete: z.function()
    .input(z.tuple([z.string(), DataEngineDeleteOptionsSchema.optional()]))
    .output(z.promise(z.unknown())),
    
  count: z.function()
    .input(z.tuple([z.string(), DataEngineCountOptionsSchema.optional()]))
    .output(z.promise(z.number())),
    
  aggregate: z.function()
    .input(z.tuple([z.string(), DataEngineAggregateOptionsSchema]))
    .output(z.promise(z.array(z.unknown())))
}).describe('Standard Data Engine Contract');

// ==========================================================================
// 9. Virtualization & RPC Protocol
// ==========================================================================

/**
 * Data Engine RPC Request (Virtual ObjectQL)
 * 
 * This schema defines the serialized format for executing Data Engine operations
 * via HTTP, Message Queue, or Plugin boundaries.
 * 
 * It enables "Virtual Data Engines" where the implementation resides in a 
 * separate microservice or plugin.
 */

export const DataEngineFindRequestSchema = z.object({
  method: z.literal('find'),
  object: z.string(),
  query: DataEngineQueryOptionsSchema.optional()
});

export const DataEngineFindOneRequestSchema = z.object({
  method: z.literal('findOne'),
  object: z.string(),
  query: DataEngineQueryOptionsSchema.optional()
});

export const DataEngineInsertRequestSchema = z.object({
  method: z.literal('insert'),
  object: z.string(),
  data: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]),
  options: DataEngineInsertOptionsSchema.optional()
});

export const DataEngineUpdateRequestSchema = z.object({
  method: z.literal('update'),
  object: z.string(),
  data: z.record(z.string(), z.unknown()),
  id: z.union([z.string(), z.number()]).optional().describe('ID for single update, or use filter in options'),
  options: DataEngineUpdateOptionsSchema.optional()
});

export const DataEngineDeleteRequestSchema = z.object({
  method: z.literal('delete'),
  object: z.string(),
  id: z.union([z.string(), z.number()]).optional().describe('ID for single delete, or use filter in options'),
  options: DataEngineDeleteOptionsSchema.optional()
});

export const DataEngineCountRequestSchema = z.object({
  method: z.literal('count'),
  object: z.string(),
  query: DataEngineCountOptionsSchema.optional()
});

export const DataEngineAggregateRequestSchema = z.object({
  method: z.literal('aggregate'),
  object: z.string(),
  query: DataEngineAggregateOptionsSchema
});

/**
 * Data Engine Execute Request (Raw Command)
 * Execute a raw command/query native to the driver (e.g. SQL, Shell, Remote API).
 */
export const DataEngineExecuteRequestSchema = z.object({
  method: z.literal('execute'),
  /** The abstract command (string SQL, or JSON object) */
  command: z.unknown(),
  /** Optional options */
  options: z.record(z.string(), z.unknown()).optional()
});

/**
 * Data Engine Vector Find Request (AI/RAG)
 * Perform a similarity search using vector embeddings.
 */
export const DataEngineVectorFindRequestSchema = z.object({
  method: z.literal('vectorFind'),
  object: z.string(),
  /** The vector embedding to search for */
  vector: z.array(z.number()),
  /** Optional pre-filter (Metadata filtering) */
  filter: DataEngineFilterSchema.optional(),
  /** Fields to select */
  select: z.array(z.string()).optional(),
  /** Number of results */
  limit: z.number().int().default(5).optional(),
  /** Minimum similarity score (0-1) or distance threshold */
  threshold: z.number().optional()
});

/**
 * Data Engine Batch Request
 * Execute multiple operations in a single transaction/request efficiently.
 */
export const DataEngineBatchRequestSchema = z.object({
  method: z.literal('batch'),
  requests: z.array(z.discriminatedUnion('method', [
    DataEngineFindRequestSchema,
    DataEngineFindOneRequestSchema,
    DataEngineInsertRequestSchema,
    DataEngineUpdateRequestSchema,
    DataEngineDeleteRequestSchema,
    DataEngineCountRequestSchema,
    DataEngineAggregateRequestSchema,
    DataEngineExecuteRequestSchema,
    DataEngineVectorFindRequestSchema
  ])),
  /** 
   * Transaction Mode
   * - true: All or nothing (Atomic)
   * - false: Best effort, continue on error
   */
  transaction: z.boolean().default(true).optional()
});

/**
 * Unified Data Engine Request Union
 * Use this to validate any incoming "Virtual ObjectQL" request.
 */
export const DataEngineRequestSchema = z.discriminatedUnion('method', [
  DataEngineFindRequestSchema,
  DataEngineFindOneRequestSchema,
  DataEngineInsertRequestSchema,
  DataEngineUpdateRequestSchema,
  DataEngineDeleteRequestSchema,
  DataEngineCountRequestSchema,
  DataEngineAggregateRequestSchema,
  DataEngineBatchRequestSchema,
  DataEngineExecuteRequestSchema,
  DataEngineVectorFindRequestSchema
]).describe('Virtual ObjectQL Request Protocol');

// ==========================================================================
// 10. Type Exports
// ==========================================================================

export type DataEngineFilter = z.infer<typeof DataEngineFilterSchema>;
export type DataEngineSort = z.infer<typeof DataEngineSortSchema>;
export type BaseEngineOptions = z.infer<typeof BaseEngineOptionsSchema>;
export type DataEngineQueryOptions = z.infer<typeof DataEngineQueryOptionsSchema>;
export type DataEngineInsertOptions = z.infer<typeof DataEngineInsertOptionsSchema>;
export type DataEngineUpdateOptions = z.infer<typeof DataEngineUpdateOptionsSchema>;
export type DataEngineDeleteOptions = z.infer<typeof DataEngineDeleteOptionsSchema>;
export type DataEngineAggregateOptions = z.infer<typeof DataEngineAggregateOptionsSchema>;
export type DataEngineCountOptions = z.infer<typeof DataEngineCountOptionsSchema>;
export type DataEngineRequest = z.infer<typeof DataEngineRequestSchema>;

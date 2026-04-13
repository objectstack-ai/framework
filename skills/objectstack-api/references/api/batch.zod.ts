// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { ApiErrorSchema, BaseResponseSchema, RecordDataSchema } from './contract.zod';

/**
 * Batch Operations API
 * 
 * Provides efficient bulk data operations with transaction support.
 * Implements P0/P1 requirements for ObjectStack kernel.
 * 
 * Features:
 * - Batch create/update/delete operations
 * - Atomic transaction support (all-or-none)
 * - Partial success handling
 * - Detailed error reporting per record
 * 
 * Industry alignment: Salesforce Bulk API, Microsoft Dynamics Bulk Operations
 */

// ==========================================
// Batch Operation Types
// ==========================================

/**
 * Batch Operation Type Enum
 * Defines the type of batch operation to perform
 */
export const BatchOperationType = z.enum([
  'create',    // Batch insert
  'update',    // Batch update
  'upsert',    // Batch upsert (insert or update based on external ID)
  'delete',    // Batch delete
]);

export type BatchOperationType = z.infer<typeof BatchOperationType>;

// ==========================================
// Batch Request Schemas
// ==========================================

/**
 * Batch Record Schema
 * Individual record in a batch operation
 */
export const BatchRecordSchema = z.object({
  id: z.string().optional().describe('Record ID (required for update/delete)'),
  data: RecordDataSchema.optional().describe('Record data (required for create/update/upsert)'),
  externalId: z.string().optional().describe('External ID for upsert matching'),
});

export type BatchRecord = z.infer<typeof BatchRecordSchema>;

/**
 * Batch Operation Options Schema
 * Configuration options for batch operations
 */
export const BatchOptionsSchema = z.object({
  atomic: z.boolean().optional().default(true).describe('If true, rollback entire batch on any failure (transaction mode)'),
  returnRecords: z.boolean().optional().default(false).describe('If true, return full record data in response'),
  continueOnError: z.boolean().optional().default(false).describe('If true (and atomic=false), continue processing remaining records after errors'),
  validateOnly: z.boolean().optional().default(false).describe('If true, validate records without persisting changes (dry-run mode)'),
});

export type BatchOptions = z.infer<typeof BatchOptionsSchema>;

/**
 * Batch Update Request Schema
 * Request payload for batch update operations
 * 
 * @example
 * // POST /api/v1/data/{object}/batch
 * {
 *   "operation": "update",
 *   "records": [
 *     { "id": "1", "data": { "name": "Updated Name 1", "status": "active" } },
 *     { "id": "2", "data": { "name": "Updated Name 2", "status": "active" } }
 *   ],
 *   "options": {
 *     "atomic": true,
 *     "returnRecords": true
 *   }
 * }
 */
export const BatchUpdateRequestSchema = z.object({
  operation: BatchOperationType.describe('Type of batch operation'),
  records: z.array(BatchRecordSchema).min(1).max(200).describe('Array of records to process (max 200 per batch)'),
  options: BatchOptionsSchema.optional().describe('Batch operation options'),
});

export type BatchUpdateRequest = z.input<typeof BatchUpdateRequestSchema>;

/**
 * Simplified Batch Update Request (for updateMany API)
 * Simplified request for batch updates without operation field
 * 
 * @example
 * // POST /api/v1/data/{object}/updateMany
 * {
 *   "records": [
 *     { "id": "1", "data": { "name": "Updated Name 1" } },
 *     { "id": "2", "data": { "name": "Updated Name 2" } }
 *   ],
 *   "options": { "atomic": true }
 * }
 */
export const UpdateManyRequestSchema = z.object({
  records: z.array(BatchRecordSchema).min(1).max(200).describe('Array of records to update (max 200 per batch)'),
  options: BatchOptionsSchema.optional().describe('Update options'),
});

export type UpdateManyRequest = z.input<typeof UpdateManyRequestSchema>;

// ==========================================
// Batch Response Schemas
// ==========================================

/**
 * Batch Operation Result Schema
 * Result for a single record in a batch operation
 */
export const BatchOperationResultSchema = z.object({
  id: z.string().optional().describe('Record ID if operation succeeded'),
  success: z.boolean().describe('Whether this record was processed successfully'),
  errors: z.array(ApiErrorSchema).optional().describe('Array of errors if operation failed'),
  data: RecordDataSchema.optional().describe('Full record data (if returnRecords=true)'),
  index: z.number().optional().describe('Index of the record in the request array'),
});

export type BatchOperationResult = z.infer<typeof BatchOperationResultSchema>;

/**
 * Batch Update Response Schema
 * Response payload for batch operations
 * 
 * @example Success Response
 * {
 *   "success": true,
 *   "operation": "update",
 *   "total": 2,
 *   "succeeded": 2,
 *   "failed": 0,
 *   "results": [
 *     { "id": "1", "success": true, "index": 0 },
 *     { "id": "2", "success": true, "index": 1 }
 *   ],
 *   "meta": {
 *     "timestamp": "2026-01-29T12:00:00Z",
 *     "duration": 150
 *   }
 * }
 * 
 * @example Partial Success Response (atomic=false)
 * {
 *   "success": false,
 *   "operation": "update",
 *   "total": 2,
 *   "succeeded": 1,
 *   "failed": 1,
 *   "results": [
 *     { "id": "1", "success": true, "index": 0 },
 *     { 
 *       "success": false, 
 *       "index": 1,
 *       "errors": [{ "code": "validation_error", "message": "Invalid email format" }]
 *     }
 *   ],
 *   "meta": {
 *     "timestamp": "2026-01-29T12:00:00Z"
 *   }
 * }
 */
export const BatchUpdateResponseSchema = BaseResponseSchema.extend({
  operation: BatchOperationType.optional().describe('Operation type that was performed'),
  total: z.number().describe('Total number of records in the batch'),
  succeeded: z.number().describe('Number of records that succeeded'),
  failed: z.number().describe('Number of records that failed'),
  results: z.array(BatchOperationResultSchema).describe('Detailed results for each record'),
});

export type BatchUpdateResponse = z.infer<typeof BatchUpdateResponseSchema>;

// ==========================================
// Batch Delete Schemas
// ==========================================

/**
 * Batch Delete Request Schema
 * Simplified request for batch delete operations
 * 
 * @example
 * // POST /api/v1/data/{object}/deleteMany
 * {
 *   "ids": ["1", "2", "3"],
 *   "options": { "atomic": true }
 * }
 */
export const DeleteManyRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(200).describe('Array of record IDs to delete (max 200)'),
  options: BatchOptionsSchema.optional().describe('Delete options'),
});

export type DeleteManyRequest = z.infer<typeof DeleteManyRequestSchema>;

// ==========================================
// API Contract Exports
// ==========================================

/**
 * Batch API Contracts
 * Standardized contracts for batch operations
 */
export const BatchApiContracts = {
  batchOperation: {
    input: BatchUpdateRequestSchema,
    output: BatchUpdateResponseSchema,
  },
  updateMany: {
    input: UpdateManyRequestSchema,
    output: BatchUpdateResponseSchema,
  },
  deleteMany: {
    input: DeleteManyRequestSchema,
    output: BatchUpdateResponseSchema,
  },
};

/**
 * Batch Configuration Schema
 * 
 * Configuration for enabling batch operations API.
 */
export const BatchConfigSchema = z.object({
  /** Enable batch operations */
  enabled: z.boolean().default(true).describe('Enable batch operations'),
  
  /** Maximum records per batch */
  maxRecordsPerBatch: z.number().int().min(1).max(1000).default(200).describe('Maximum records per batch'),
  
  /** Default options */
  defaultOptions: BatchOptionsSchema.optional().describe('Default batch options'),
}).passthrough(); // Allow additional properties

export type BatchConfig = z.infer<typeof BatchConfigSchema>;

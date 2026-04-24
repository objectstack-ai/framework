// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { BaseResponseSchema } from './contract.zod';

/**
 * Data Export & Import Protocol
 *
 * Defines schemas for streaming data export, import validation,
 * template-based field mapping, and scheduled export jobs.
 *
 * Industry alignment: Salesforce Data Export, Airtable CSV Export,
 * Dynamics 365 Data Management.
 *
 * Base path: /api/v1/data/{object}/export
 */

// ==========================================
// 1. Export Format & Configuration
// ==========================================

/**
 * Export Format Enum
 * Supported file formats for data export.
 */
import { lazySchema } from '../shared/lazy-schema';
export const ExportFormat = z.enum([
  'csv',
  'json',
  'jsonl',
  'xlsx',
  'parquet',
]);
export type ExportFormat = z.infer<typeof ExportFormat>;

/**
 * Export Job Status
 */
export const ExportJobStatus = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);
export type ExportJobStatus = z.infer<typeof ExportJobStatus>;

// ==========================================
// 2. Export Job Request / Response
// ==========================================

/**
 * Create Export Job Request
 * Initiates an asynchronous streaming export.
 *
 * @example POST /api/v1/data/account/export
 * { format: 'csv', fields: ['name', 'email', 'status'], filter: { status: 'active' }, limit: 10000 }
 */
export const CreateExportJobRequestSchema = lazySchema(() => z.object({
  object: z.string().describe('Object name to export'),
  format: ExportFormat.default('csv').describe('Export file format'),
  fields: z.array(z.string()).optional()
    .describe('Specific fields to include (omit for all fields)'),
  filter: z.record(z.string(), z.unknown()).optional()
    .describe('Filter criteria for records to export'),
  sort: z.array(z.object({
    field: z.string().describe('Field name to sort by'),
    direction: z.enum(['asc', 'desc']).default('asc').describe('Sort direction'),
  })).optional().describe('Sort order for exported records'),
  limit: z.number().int().min(1).optional()
    .describe('Maximum number of records to export'),
  includeHeaders: z.boolean().default(true)
    .describe('Include header row (CSV/XLSX)'),
  encoding: z.string().default('utf-8')
    .describe('Character encoding for the export file'),
  templateId: z.string().optional()
    .describe('Export template ID for predefined field mappings'),
}));
export type CreateExportJobRequest = z.infer<typeof CreateExportJobRequestSchema>;

/**
 * Export Job Response
 * Returns the created export job with tracking info.
 */
export const CreateExportJobResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    jobId: z.string().describe('Export job ID'),
    status: ExportJobStatus.describe('Initial job status'),
    estimatedRecords: z.number().int().optional().describe('Estimated total records'),
    createdAt: z.string().datetime().describe('Job creation timestamp'),
  }),
}));
export type CreateExportJobResponse = z.infer<typeof CreateExportJobResponseSchema>;

/**
 * Export Job Progress
 * Tracks the progress of an active export job.
 *
 * @example GET /api/v1/data/export/:jobId
 */
export const ExportJobProgressSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    jobId: z.string().describe('Export job ID'),
    status: ExportJobStatus.describe('Current job status'),
    format: ExportFormat.describe('Export format'),
    totalRecords: z.number().int().optional().describe('Total records to export'),
    processedRecords: z.number().int().describe('Records processed so far'),
    percentComplete: z.number().min(0).max(100).describe('Export progress percentage'),
    fileSize: z.number().int().optional().describe('Current file size in bytes'),
    downloadUrl: z.string().optional()
      .describe('Presigned download URL (available when status is "completed")'),
    downloadExpiresAt: z.string().datetime().optional()
      .describe('Download URL expiration timestamp'),
    error: z.object({
      code: z.string().describe('Error code'),
      message: z.string().describe('Error message'),
    }).optional().describe('Error details if job failed'),
    startedAt: z.string().datetime().optional().describe('Processing start timestamp'),
    completedAt: z.string().datetime().optional().describe('Completion timestamp'),
  }),
}));
export type ExportJobProgress = z.infer<typeof ExportJobProgressSchema>;

// ==========================================
// 3. Import Validation & Deduplication
// ==========================================

/**
 * Import Validation Mode
 */
export const ImportValidationMode = z.enum([
  'strict',      // Reject entire import on any validation error
  'lenient',     // Skip invalid records, import valid ones
  'dry_run',     // Validate all records without persisting
]);
export type ImportValidationMode = z.infer<typeof ImportValidationMode>;

/**
 * Deduplication Strategy
 * How to handle duplicate records during import.
 */
export const DeduplicationStrategy = z.enum([
  'skip',           // Skip duplicates (keep existing)
  'update',         // Update existing with import data
  'create_new',     // Create new record even if duplicate
  'fail',           // Fail the import if duplicates found
]);
export type DeduplicationStrategy = z.infer<typeof DeduplicationStrategy>;

/**
 * Import Validation Config Schema
 * Configuration for validating and deduplicating imported data.
 *
 * @example
 * {
 *   mode: 'lenient',
 *   deduplication: { strategy: 'update', matchFields: ['email', 'external_id'] },
 *   maxErrors: 50,
 *   trimWhitespace: true,
 * }
 */
export const ImportValidationConfigSchema = lazySchema(() => z.object({
  mode: ImportValidationMode.default('strict')
    .describe('Validation mode for the import'),
  deduplication: z.object({
    strategy: DeduplicationStrategy.default('skip')
      .describe('How to handle duplicate records'),
    matchFields: z.array(z.string()).min(1)
      .describe('Fields used to identify duplicates (e.g., "email", "external_id")'),
  }).optional().describe('Deduplication configuration'),
  maxErrors: z.number().int().min(1).default(100)
    .describe('Maximum validation errors before aborting'),
  trimWhitespace: z.boolean().default(true)
    .describe('Trim leading/trailing whitespace from string fields'),
  dateFormat: z.string().optional()
    .describe('Expected date format in import data (e.g., "YYYY-MM-DD")'),
  nullValues: z.array(z.string()).optional()
    .describe('Strings to treat as null (e.g., ["", "N/A", "null"])'),
}));
export type ImportValidationConfig = z.infer<typeof ImportValidationConfigSchema>;

/**
 * Import Validation Result Schema
 * Summary of the import validation pass.
 */
export const ImportValidationResultSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    totalRecords: z.number().int().describe('Total records in import file'),
    validRecords: z.number().int().describe('Records that passed validation'),
    invalidRecords: z.number().int().describe('Records that failed validation'),
    duplicateRecords: z.number().int().describe('Duplicate records detected'),
    errors: z.array(z.object({
      row: z.number().int().describe('Row number in the import file'),
      field: z.string().optional().describe('Field that failed validation'),
      code: z.string().describe('Validation error code'),
      message: z.string().describe('Validation error message'),
    })).describe('List of validation errors'),
    preview: z.array(z.record(z.string(), z.unknown())).optional()
      .describe('Preview of first N valid records (for dry_run mode)'),
  }),
}));
export type ImportValidationResult = z.infer<typeof ImportValidationResultSchema>;

// ==========================================
// 4. Export/Import Template
// ==========================================

/**
 * Field Mapping Entry Schema
 * Maps a source field to a target field with optional transformation.
 */
export const FieldMappingEntrySchema = lazySchema(() => z.object({
  sourceField: z.string().describe('Field name in the source data (import) or object (export)'),
  targetField: z.string().describe('Field name in the target object (import) or file column (export)'),
  targetLabel: z.string().optional().describe('Display label for the target column (export)'),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'trim', 'date_format', 'lookup'])
    .default('none')
    .describe('Transformation to apply during mapping'),
  defaultValue: z.unknown().optional()
    .describe('Default value if source field is null/empty'),
  required: z.boolean().default(false)
    .describe('Whether this field is required (import validation)'),
}));
export type FieldMappingEntry = z.infer<typeof FieldMappingEntrySchema>;

/**
 * Export/Import Template Schema
 * Reusable template for predefined field mappings.
 *
 * @example
 * {
 *   name: 'account_export_v1',
 *   label: 'Account Export (Standard)',
 *   object: 'account',
 *   direction: 'export',
 *   mappings: [
 *     { sourceField: 'name', targetField: 'Company Name' },
 *     { sourceField: 'email', targetField: 'Email', transform: 'lowercase' },
 *   ],
 * }
 */
export const ExportImportTemplateSchema = lazySchema(() => z.object({
  id: z.string().optional().describe('Template ID (generated on save)'),
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Template machine name (snake_case)'),
  label: z.string().describe('Human-readable template label'),
  description: z.string().optional().describe('Template description'),
  object: z.string().describe('Target object name'),
  direction: z.enum(['import', 'export', 'bidirectional'])
    .describe('Template direction'),
  format: ExportFormat.optional().describe('Default file format for this template'),
  mappings: z.array(FieldMappingEntrySchema).min(1)
    .describe('Field mapping entries'),
  createdAt: z.string().datetime().optional().describe('Template creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
  createdBy: z.string().optional().describe('User who created the template'),
}));
export type ExportImportTemplate = z.infer<typeof ExportImportTemplateSchema>;

// ==========================================
// 5. Scheduled Export Jobs
// ==========================================

/**
 * Scheduled Export Schema
 * Defines a recurring data export job.
 *
 * @example
 * {
 *   name: 'weekly_account_export',
 *   object: 'account',
 *   format: 'csv',
 *   schedule: { cronExpression: '0 6 * * MON', timezone: 'America/New_York' },
 *   delivery: { method: 'email', recipients: ['admin@example.com'] },
 * }
 */
export const ScheduledExportSchema = lazySchema(() => z.object({
  id: z.string().optional().describe('Scheduled export ID'),
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Schedule name (snake_case)'),
  label: z.string().optional().describe('Human-readable label'),
  object: z.string().describe('Object name to export'),
  format: ExportFormat.default('csv').describe('Export file format'),
  fields: z.array(z.string()).optional().describe('Fields to include'),
  filter: z.record(z.string(), z.unknown()).optional().describe('Record filter criteria'),
  templateId: z.string().optional().describe('Export template ID for field mappings'),
  schedule: z.object({
    cronExpression: z.string().describe('Cron expression for schedule'),
    timezone: z.string().default('UTC').describe('IANA timezone'),
  }).describe('Schedule timing configuration'),
  delivery: z.object({
    method: z.enum(['email', 'storage', 'webhook'])
      .describe('How to deliver the export file'),
    recipients: z.array(z.string()).optional()
      .describe('Email recipients (for email delivery)'),
    storagePath: z.string().optional()
      .describe('Storage path (for storage delivery)'),
    webhookUrl: z.string().optional()
      .describe('Webhook URL (for webhook delivery)'),
  }).describe('Export delivery configuration'),
  enabled: z.boolean().default(true).describe('Whether the scheduled export is active'),
  lastRunAt: z.string().datetime().optional().describe('Last execution timestamp'),
  nextRunAt: z.string().datetime().optional().describe('Next scheduled execution'),
  createdAt: z.string().datetime().optional().describe('Creation timestamp'),
  createdBy: z.string().optional().describe('User who created the schedule'),
}));
export type ScheduledExport = z.infer<typeof ScheduledExportSchema>;

// ==========================================
// 6. Get Export Job Download
// ==========================================

/**
 * Get Export Job Download Request
 * Retrieves a presigned download link for a completed export job.
 *
 * @example GET /api/v1/data/export/:jobId/download
 */
export const GetExportJobDownloadRequestSchema = lazySchema(() => z.object({
  jobId: z.string().describe('Export job ID'),
}));
export type GetExportJobDownloadRequest = z.infer<typeof GetExportJobDownloadRequestSchema>;

/**
 * Get Export Job Download Response
 * Returns the presigned download URL and metadata.
 */
export const GetExportJobDownloadResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    jobId: z.string().describe('Export job ID'),
    downloadUrl: z.string().describe('Presigned download URL'),
    fileName: z.string().describe('Suggested file name'),
    fileSize: z.number().int().describe('File size in bytes'),
    format: ExportFormat.describe('Export file format'),
    expiresAt: z.string().datetime().describe('Download URL expiration timestamp'),
    checksum: z.string().optional().describe('File checksum (SHA-256)'),
  }),
}));
export type GetExportJobDownloadResponse = z.infer<typeof GetExportJobDownloadResponseSchema>;

// ==========================================
// 7. List Export Jobs
// ==========================================

/**
 * List Export Jobs Request
 * Retrieves a paginated list of historical export jobs.
 *
 * @example GET /api/v1/data/export?object=account&status=completed&limit=20
 */
export const ListExportJobsRequestSchema = lazySchema(() => z.object({
  object: z.string().optional().describe('Filter by object name'),
  status: ExportJobStatus.optional().describe('Filter by job status'),
  limit: z.number().int().min(1).max(100).default(20)
    .describe('Maximum number of jobs to return'),
  cursor: z.string().optional()
    .describe('Pagination cursor from a previous response'),
}));
export type ListExportJobsRequest = z.infer<typeof ListExportJobsRequestSchema>;

/**
 * Export Job Summary
 * Compact representation of an export job for list views.
 */
export const ExportJobSummarySchema = lazySchema(() => z.object({
  jobId: z.string().describe('Export job ID'),
  object: z.string().describe('Object name that was exported'),
  status: ExportJobStatus.describe('Current job status'),
  format: ExportFormat.describe('Export file format'),
  totalRecords: z.number().int().optional().describe('Total records exported'),
  fileSize: z.number().int().optional().describe('File size in bytes'),
  createdAt: z.string().datetime().describe('Job creation timestamp'),
  completedAt: z.string().datetime().optional().describe('Completion timestamp'),
  createdBy: z.string().optional().describe('User who initiated the export'),
}));
export type ExportJobSummary = z.infer<typeof ExportJobSummarySchema>;

/**
 * List Export Jobs Response
 * Paginated list of export jobs with cursor-based pagination.
 */
export const ListExportJobsResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    jobs: z.array(ExportJobSummarySchema).describe('List of export jobs'),
    nextCursor: z.string().optional().describe('Cursor for the next page'),
    hasMore: z.boolean().describe('Whether more jobs are available'),
  }),
}));
export type ListExportJobsResponse = z.infer<typeof ListExportJobsResponseSchema>;

// ==========================================
// 8. Schedule Export Request/Response
// ==========================================

/**
 * Schedule Export Request
 * Creates a new scheduled (recurring) export job.
 *
 * @example POST /api/v1/data/export/schedules
 */
export const ScheduleExportRequestSchema = lazySchema(() => z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Schedule name (snake_case)'),
  label: z.string().optional().describe('Human-readable label'),
  object: z.string().describe('Object name to export'),
  format: ExportFormat.default('csv').describe('Export file format'),
  fields: z.array(z.string()).optional().describe('Fields to include'),
  filter: z.record(z.string(), z.unknown()).optional().describe('Record filter criteria'),
  templateId: z.string().optional().describe('Export template ID for field mappings'),
  schedule: z.object({
    cronExpression: z.string().describe('Cron expression for schedule'),
    timezone: z.string().default('UTC').describe('IANA timezone'),
  }).describe('Schedule timing configuration'),
  delivery: z.object({
    method: z.enum(['email', 'storage', 'webhook'])
      .describe('How to deliver the export file'),
    recipients: z.array(z.string()).optional()
      .describe('Email recipients (for email delivery)'),
    storagePath: z.string().optional()
      .describe('Storage path (for storage delivery)'),
    webhookUrl: z.string().optional()
      .describe('Webhook URL (for webhook delivery)'),
  }).describe('Export delivery configuration'),
}));
export type ScheduleExportRequest = z.infer<typeof ScheduleExportRequestSchema>;

/**
 * Schedule Export Response
 * Returns the created scheduled export with generated ID and next run info.
 */
export const ScheduleExportResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    id: z.string().describe('Scheduled export ID'),
    name: z.string().describe('Schedule name'),
    enabled: z.boolean().describe('Whether the schedule is active'),
    nextRunAt: z.string().datetime().optional().describe('Next scheduled execution'),
    createdAt: z.string().datetime().describe('Creation timestamp'),
  }),
}));
export type ScheduleExportResponse = z.infer<typeof ScheduleExportResponseSchema>;

// ==========================================
// 9. Export API Contracts
// ==========================================

/**
 * Export API Contract Registry
 * Used for generating SDKs, documentation, and route registration.
 */
export const ExportApiContracts = {
  createExportJob: {
    method: 'POST' as const,
    path: '/api/v1/data/:object/export',
    input: CreateExportJobRequestSchema,
    output: CreateExportJobResponseSchema,
  },
  getExportJobProgress: {
    method: 'GET' as const,
    path: '/api/v1/data/export/:jobId',
    input: z.object({ jobId: z.string() }),
    output: ExportJobProgressSchema,
  },
  getExportJobDownload: {
    method: 'GET' as const,
    path: '/api/v1/data/export/:jobId/download',
    input: GetExportJobDownloadRequestSchema,
    output: GetExportJobDownloadResponseSchema,
  },
  listExportJobs: {
    method: 'GET' as const,
    path: '/api/v1/data/export',
    input: ListExportJobsRequestSchema,
    output: ListExportJobsResponseSchema,
  },
  scheduleExport: {
    method: 'POST' as const,
    path: '/api/v1/data/export/schedules',
    input: ScheduleExportRequestSchema,
    output: ScheduleExportResponseSchema,
  },
  cancelExportJob: {
    method: 'POST' as const,
    path: '/api/v1/data/export/:jobId/cancel',
    input: z.object({ jobId: z.string() }),
    output: BaseResponseSchema,
  },
};

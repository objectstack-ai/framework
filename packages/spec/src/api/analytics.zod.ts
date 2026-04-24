// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { AnalyticsQuerySchema, CubeSchema } from '../data/analytics.zod';
import { BaseResponseSchema } from './contract.zod';

/**
 * Analytics API Protocol
 * 
 * Defines the HTTP interface for the Semantic Layer.
 * Provides endpoints for executing analytical queries and discovering metadata.
 */

// ==========================================
// 1. API Endpoints
// ==========================================

import { lazySchema } from '../shared/lazy-schema';
export const AnalyticsEndpoint = z.enum([
  '/api/v1/analytics/query', // Execute analysis
  '/api/v1/analytics/meta',  // Discover cubes/metrics
  '/api/v1/analytics/sql',   // Dry-run SQL generation
]);

// ==========================================
// 2. Query Execution
// ==========================================

/**
 * Query Request Body
 */
export const AnalyticsQueryRequestSchema = lazySchema(() => z.object({
  query: AnalyticsQuerySchema.describe('The analytic query definition'),
  cube: z.string().describe('Target cube name'),
  format: z.enum(['json', 'csv', 'xlsx']).default('json').describe('Response format'),
}));

/**
 * Query Response (JSON)
 */
export const AnalyticsResultResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())).describe('Result rows'),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })).describe('Column metadata'),
    sql: z.string().optional().describe('Executed SQL (if debug enabled)'),
  }),
}));

// ==========================================
// 3. Metadata Discovery
// ==========================================

/**
 * Meta Request
 */
export const GetAnalyticsMetaRequestSchema = lazySchema(() => z.object({
  cube: z.string().optional().describe('Optional cube name to filter'),
}));

/**
 * Meta Response
 * Returns available cubes, metrics, and dimensions.
 */
export const AnalyticsMetadataResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    cubes: z.array(CubeSchema).describe('Available cubes'),
  }),
}));

// ==========================================
// 4. SQL Dry-Run
// ==========================================

export const AnalyticsSqlResponseSchema = lazySchema(() => BaseResponseSchema.extend({
  data: z.object({
    sql: z.string(),
    params: z.array(z.unknown()),
  }),
}));

export type AnalyticsEndpoint = z.infer<typeof AnalyticsEndpoint>;
export type AnalyticsQueryRequest = z.infer<typeof AnalyticsQueryRequestSchema>;
export type AnalyticsMetadataResponse = z.infer<typeof AnalyticsMetadataResponseSchema>;
export type AnalyticsSqlResponse = z.infer<typeof AnalyticsSqlResponseSchema>;

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

// ============================================================================
// Shared Enumerations
// ============================================================================

/** Aggregation functions used across query, data-engine, analytics, field */
export const AggregationFunctionEnum = z.enum([
  'count', 'sum', 'avg', 'min', 'max',
  'count_distinct', 'percentile', 'median', 'stddev', 'variance',
]).describe('Standard aggregation functions');
export type AggregationFunction = z.infer<typeof AggregationFunctionEnum>;

/** Sort direction used across query, data-engine, analytics */
export const SortDirectionEnum = z.enum(['asc', 'desc'])
  .describe('Sort order direction');
export type SortDirection = z.infer<typeof SortDirectionEnum>;

/** Reusable sort item — field + direction pair used across views, data sources, filters */
export const SortItemSchema = z.object({
  field: z.string().describe('Field name to sort by'),
  order: SortDirectionEnum.describe('Sort direction'),
}).describe('Sort field and direction pair');
export type SortItem = z.infer<typeof SortItemSchema>;

/** CRUD mutation events used across hook, validation, object CDC */
export const MutationEventEnum = z.enum([
  'insert', 'update', 'delete', 'upsert',
]).describe('Data mutation event types');
export type MutationEvent = z.infer<typeof MutationEventEnum>;

/** Database isolation levels — unified format */
export const IsolationLevelEnum = z.enum([
  'read_uncommitted', 'read_committed', 'repeatable_read', 'serializable', 'snapshot',
]).describe('Transaction isolation levels (snake_case standard)');
export type IsolationLevel = z.infer<typeof IsolationLevelEnum>;

/** Cache eviction strategies */
export const CacheStrategyEnum = z.enum(['lru', 'lfu', 'ttl', 'fifo'])
  .describe('Cache eviction strategy');
export type CacheStrategy = z.infer<typeof CacheStrategyEnum>;

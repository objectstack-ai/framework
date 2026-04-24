// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Base Field Mapping Protocol
 * 
 * Shared by: ETL, Sync, Connector, External Lookup
 * 
 * This module provides the canonical field mapping schema used across
 * ObjectStack for data transformation and synchronization.
 * 
 * **Use Cases:**
 * - ETL pipelines (data/mapping.zod.ts)
 * - Data synchronization (automation/sync.zod.ts)
 * - Integration connectors (integration/connector.zod.ts)
 * - External lookups (data/external-lookup.zod.ts)
 * 
 * @example Basic field mapping
 * ```typescript
 * const mapping: FieldMapping = {
 *   source: 'external_user_id',
 *   target: 'user_id',
 * };
 * ```
 * 
 * @example With transformation
 * ```typescript
 * const mapping: FieldMapping = {
 *   source: 'user_name',
 *   target: 'name',
 *   transform: { type: 'cast', targetType: 'string' },
 *   defaultValue: 'Unknown'
 * };
 * ```
 */

/**
 * Transform Type Schema
 * 
 * Defines the type of transformation to apply to a field value.
 * Implementations can extend this for domain-specific transforms.
 */
import { lazySchema } from './lazy-schema';
export const TransformTypeSchema = lazySchema(() => z.discriminatedUnion('type', [
  z.object({
    type: z.literal('constant'),
    value: z.unknown().describe('Constant value to use'),
  }).describe('Set a constant value'),
  
  z.object({
    type: z.literal('cast'),
    targetType: z.enum(['string', 'number', 'boolean', 'date']).describe('Target data type'),
  }).describe('Cast to a specific data type'),
  
  z.object({
    type: z.literal('lookup'),
    table: z.string().describe('Lookup table name'),
    keyField: z.string().describe('Field to match on'),
    valueField: z.string().describe('Field to retrieve'),
  }).describe('Lookup value from another table'),
  
  z.object({
    type: z.literal('javascript'),
    expression: z.string().describe('JavaScript expression (e.g., "value.toUpperCase()")'),
  }).describe('Custom JavaScript transformation'),
  
  z.object({
    type: z.literal('map'),
    mappings: z.record(z.string(), z.unknown()).describe('Value mappings (e.g., {"Active": "active"})'),
  }).describe('Map values using a dictionary'),
]));

export type TransformType = z.infer<typeof TransformTypeSchema>;

/**
 * Field Mapping Schema
 * 
 * Base schema for mapping fields between source and target systems.
 * 
 * **NAMING CONVENTION:**
 * - source: Field name in the source system
 * - target: Field name in the target system (should be snake_case for ObjectStack)
 * 
 * @example
 * ```typescript
 * {
 *   source: 'FirstName',
 *   target: 'first_name',
 *   transform: { type: 'cast', targetType: 'string' },
 *   defaultValue: ''
 * }
 * ```
 */
export const FieldMappingSchema = lazySchema(() => z.object({
  /**
   * Source field name
   */
  source: z.string().describe('Source field name'),
  
  /**
   * Target field name (should be snake_case for ObjectStack)
   */
  target: z.string().describe('Target field name'),
  
  /**
   * Transformation to apply
   */
  transform: TransformTypeSchema.optional().describe('Transformation to apply'),
  
  /**
   * Default value if source is null/undefined
   */
  defaultValue: z.unknown().optional().describe('Default if source is null/undefined'),
}));

export type FieldMapping = z.infer<typeof FieldMappingSchema>;

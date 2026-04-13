// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { HttpMethod, RateLimitConfigSchema } from '../shared/http.zod';

/**
 * API Mapping Schema
 * Transform input/output data.
 */
export const ApiMappingSchema = z.object({
  source: z.string().describe('Source field/path'),
  target: z.string().describe('Target field/path'),
  transform: z.string().optional().describe('Transformation function name'),
});

/**
 * API Endpoint Schema
 * Defines an external facing API contract.
 */
export const ApiEndpointSchema = z.object({
  /** Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Unique endpoint ID'),
  path: z.string().regex(/^\//).describe('URL Path (e.g. /api/v1/customers)'),
  method: HttpMethod.describe('HTTP Method'),
  
  /** Documentation */
  summary: z.string().optional(),
  description: z.string().optional(),
  
  /** Execution Logic */
  type: z.enum(['flow', 'script', 'object_operation', 'proxy']).describe('Implementation type'),
  target: z.string().describe('Target Flow ID, Script Name, or Proxy URL'),
  
  /** Logic Config */
  objectParams: z.object({
    object: z.string().optional(),
    operation: z.enum(['find', 'get', 'create', 'update', 'delete']).optional(),
  }).optional().describe('For object_operation type'),
  
  /** Data Transformation */
  inputMapping: z.array(ApiMappingSchema).optional().describe('Map Request Body to Internal Params'),
  outputMapping: z.array(ApiMappingSchema).optional().describe('Map Internal Result to Response Body'),
  
  /** Policies */
  authRequired: z.boolean().default(true).describe('Require authentication'),
  rateLimit: RateLimitConfigSchema.optional().describe('Rate limiting policy'),
  cacheTtl: z.number().optional().describe('Response cache TTL in seconds'),
});

export const ApiEndpoint = Object.assign(ApiEndpointSchema, {
  create: <T extends z.input<typeof ApiEndpointSchema>>(config: T) => config,
});

export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>;
export type ApiEndpointInput = z.input<typeof ApiEndpointSchema>;

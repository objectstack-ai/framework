// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';

/**
 * Feature Rollout Strategy
 */
export const FeatureStrategy = z.enum([
  'boolean',        // Simple On/Off
  'percentage',     // Gradual rollout (0-100%)
  'user_list',      // Specific users
  'group',          // Specific groups/roles
  'custom'          // Custom constraint/script
]);

/**
 * Feature Flag Protocol
 * 
 * Manages feature toggles and gradual rollouts.
 * Used for CI/CD, A/B Testing, and Trunk-Based Development.
 */
export const FeatureFlagSchema = z.object({
  name: SnakeCaseIdentifierSchema.describe('Feature key (snake_case)'),
  label: z.string().optional().describe('Display label'),
  description: z.string().optional(),
  
  /** Default state */
  enabled: z.boolean().default(false).describe('Is globally enabled'),
  
  /** Rollout Strategy */
  strategy: FeatureStrategy.default('boolean'),
  
  /** Strategy Configuration */
  conditions: z.object({
    percentage: z.number().min(0).max(100).optional(),
    users: z.array(z.string()).optional(),
    groups: z.array(z.string()).optional(),
    expression: z.string().optional().describe('Custom formula expression')
  }).optional(),
  
  /** Integration */
  environment: z.enum(['dev', 'staging', 'prod', 'all']).default('all')
    .describe('Environment validity'),
    
  /** Expiration */
  expiresAt: z.string().datetime().optional().describe('Feature flag expiration date'),
});

export const FeatureFlag = Object.assign(FeatureFlagSchema, {
  create: <T extends z.input<typeof FeatureFlagSchema>>(config: T) => config,
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlagInput = z.input<typeof FeatureFlagSchema>;

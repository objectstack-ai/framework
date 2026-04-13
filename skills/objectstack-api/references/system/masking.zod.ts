// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Data masking protocol for PII protection
 */
export const MaskingStrategySchema = z.enum([
  'redact',       // Complete redaction: ****
  'partial',      // Partial masking: 138****5678
  'hash',         // Hash value: sha256(value)
  'tokenize',     // Tokenization: token-12345
  'randomize',    // Randomize: generate random value
  'nullify',      // Null value: null
  'substitute',   // Substitute with dummy data
]).describe('Data masking strategy for PII protection');

export type MaskingStrategy = z.infer<typeof MaskingStrategySchema>;

export const MaskingRuleSchema = z.object({
  field: z.string().describe('Field name to apply masking to'),
  strategy: MaskingStrategySchema.describe('Masking strategy to use'),
  pattern: z.string().optional().describe('Regex pattern for partial masking'),
  preserveFormat: z.boolean().default(true).describe('Keep the original data format after masking'),
  preserveLength: z.boolean().default(true).describe('Keep the original data length after masking'),
  roles: z.array(z.string()).optional().describe('Roles that see masked data'),
  exemptRoles: z.array(z.string()).optional().describe('Roles that see unmasked data'),
}).describe('Masking rule for a single field');

export type MaskingRule = z.infer<typeof MaskingRuleSchema>;
export type MaskingRuleInput = z.input<typeof MaskingRuleSchema>;

export const MaskingConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Enable data masking'),
  rules: z.array(MaskingRuleSchema).describe('List of field-level masking rules'),
  auditUnmasking: z.boolean().default(true).describe('Log when masked data is accessed unmasked'),
}).describe('Top-level data masking configuration for PII protection');

export type MaskingConfig = z.infer<typeof MaskingConfigSchema>;
export type MaskingConfigInput = z.input<typeof MaskingConfigSchema>;

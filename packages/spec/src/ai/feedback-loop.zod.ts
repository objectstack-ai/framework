// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { ChangeSetSchema } from '../system/migration.zod';

// Identifying the source of truth
import { lazySchema } from '../shared/lazy-schema';
export const MetadataSourceSchema = lazySchema(() => z.object({
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  // Logic references
  package: z.string().optional(),
  object: z.string().optional(),
  field: z.string().optional(),
  component: z.string().optional() // specific UI component or flow node
}));

// The Runtime Issue
export const IssueSchema = lazySchema(() => z.object({
  id: z.string(),
  severity: z.enum(['critical', 'error', 'warning', 'info']),
  message: z.string(),
  stackTrace: z.string().optional(),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  
  // Context snapshot
  context: z.record(z.string(), z.unknown()).optional(),
  
  // The suspected metadata culprit
  source: MetadataSourceSchema.optional()
}));

// The AI's proposed resolution
export const ResolutionSchema = lazySchema(() => z.object({
  issueId: z.string(),
  reasoning: z.string().describe('Explanation of why this fix is needed'),
  confidence: z.number().min(0).max(1),
  
  // Actionable change to fix the issue
  fix: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('metadata_change'),
      changeSet: ChangeSetSchema
    }),
    z.object({
      type: z.literal('manual_intervention'),
      instructions: z.string()
    })
  ])
}));

// Complete Feedback Loop Record
export const FeedbackLoopSchema = lazySchema(() => z.object({
  issue: IssueSchema,
  analysis: z.string().optional().describe('AI analysis of the root cause'),
  resolutions: z.array(ResolutionSchema).optional(),
  status: z.enum(['open', 'analyzing', 'resolved', 'ignored']).default('open')
}));

export type FeedbackLoop = z.infer<typeof FeedbackLoopSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;

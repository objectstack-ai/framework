// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { TokenUsageSchema } from './cost.zod';

/**
 * Natural Language Query (NLQ) Protocol
 * 
 * Transforms natural language queries into ObjectQL AST (Abstract Syntax Tree).
 * Enables business users to query data using natural language instead of writing code.
 */

/**
 * Query Intent Type
 */
export const QueryIntentSchema = z.enum([
  'select',          // Retrieve data (e.g., "show me all accounts")
  'aggregate',       // Aggregation (e.g., "total revenue by region")
  'filter',          // Filter data (e.g., "accounts created last month")
  'sort',            // Sort data (e.g., "top 10 opportunities by value")
  'compare',         // Compare values (e.g., "compare this quarter vs last quarter")
  'trend',           // Analyze trends (e.g., "sales trend over time")
  'insight',         // Generate insights (e.g., "what's unusual about this data")
  'create',          // Create record (e.g., "create a new task")
  'update',          // Update record (e.g., "mark this as complete")
  'delete',          // Delete record (e.g., "remove this contact")
]);

/**
 * Entity Recognition
 */
export const EntitySchema = z.object({
  type: z.enum(['object', 'field', 'value', 'operator', 'function', 'timeframe']),
  text: z.string().describe('Original text from query'),
  value: z.unknown().describe('Normalized value'),
  confidence: z.number().min(0).max(1).describe('Confidence score'),
  span: z.tuple([z.number(), z.number()]).optional().describe('Character span in query'),
});

/**
 * Timeframe Detection
 */
export const TimeframeSchema = z.object({
  type: z.enum(['absolute', 'relative']),
  start: z.string().optional().describe('Start date (ISO format)'),
  end: z.string().optional().describe('End date (ISO format)'),
  relative: z.object({
    unit: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']),
    value: z.number().int(),
    direction: z.enum(['past', 'future', 'current']).default('past'),
  }).optional(),
  text: z.string().describe('Original timeframe text'),
});

/**
 * NLQ Field Mapping
 * Maps natural language field names to actual object fields
 */
export const NLQFieldMappingSchema = z.object({
  naturalLanguage: z.string().describe('NL field name (e.g., "customer name")'),
  objectField: z.string().describe('Actual field name (e.g., "account.name")'),
  object: z.string().describe('Object name'),
  field: z.string().describe('Field name'),
  confidence: z.number().min(0).max(1),
});

/**
 * Query Context
 */
export const QueryContextSchema = z.object({
  /** User Information */
  userId: z.string().optional(),
  userRole: z.string().optional(),
  
  /** Current Context */
  currentObject: z.string().optional().describe('Current object being viewed'),
  currentRecordId: z.string().optional().describe('Current record ID'),
  
  /** Conversation History */
  conversationHistory: z.array(z.object({
    query: z.string(),
    timestamp: z.string(),
    intent: QueryIntentSchema.optional(),
  })).optional(),
  
  /** Preferences */
  defaultLimit: z.number().int().default(100),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en-US'),
});

/**
 * NLQ Parse Result
 */
export const NLQParseResultSchema = z.object({
  /** Original Query */
  originalQuery: z.string(),
  
  /** Intent Detection */
  intent: QueryIntentSchema,
  intentConfidence: z.number().min(0).max(1),
  
  /** Entity Recognition */
  entities: z.array(EntitySchema),
  
  /** Object & Field Resolution */
  targetObject: z.string().optional().describe('Primary object to query'),
  fields: z.array(NLQFieldMappingSchema).optional(),
  
  /** Temporal Information */
  timeframe: TimeframeSchema.optional(),
  
  /** Query AST */
  ast: z.record(z.string(), z.unknown()).describe('Generated ObjectQL AST'),
  
  /** Metadata */
  confidence: z.number().min(0).max(1).describe('Overall confidence'),
  ambiguities: z.array(z.object({
    type: z.string(),
    description: z.string(),
    suggestions: z.array(z.string()).optional(),
  })).optional().describe('Detected ambiguities requiring clarification'),
  
  /** Alternative Interpretations */
  alternatives: z.array(z.object({
    interpretation: z.string(),
    confidence: z.number(),
    ast: z.unknown(),
  })).optional(),
});

/**
 * NLQ Request
 */
export const NLQRequestSchema = z.object({
  /** Query */
  query: z.string().describe('Natural language query'),
  
  /** Context */
  context: QueryContextSchema.optional(),
  
  /** Options */
  includeAlternatives: z.boolean().default(false).describe('Include alternative interpretations'),
  maxAlternatives: z.number().int().default(3),
  minConfidence: z.number().min(0).max(1).default(0.5).describe('Minimum confidence threshold'),
  
  /** Execution */
  executeQuery: z.boolean().default(false).describe('Execute query and return results'),
  maxResults: z.number().int().optional().describe('Maximum results to return'),
});

/**
 * NLQ Response
 */
export const NLQResponseSchema = z.object({
  /** Parse Result */
  parseResult: NLQParseResultSchema,
  
  /** Query Results (if executeQuery = true) */
  results: z.array(z.record(z.string(), z.unknown())).optional().describe('Query results'),
  totalCount: z.number().int().optional(),
  
  /** Execution Metadata */
  executionTime: z.number().optional().describe('Execution time in milliseconds'),
  needsClarification: z.boolean().describe('Whether query needs clarification'),
  
  /** Cost Tracking */
  tokens: TokenUsageSchema.optional().describe('Token usage for this query'),
  cost: z.number().nonnegative().optional().describe('Cost for this query in USD'),
  
  /** Suggestions */
  suggestions: z.array(z.string()).optional().describe('Query refinement suggestions'),
});

/**
 * NLQ Training Example
 */
export const NLQTrainingExampleSchema = z.object({
  /** Input */
  query: z.string().describe('Natural language query'),
  context: QueryContextSchema.optional(),
  
  /** Expected Output */
  expectedIntent: QueryIntentSchema,
  expectedObject: z.string().optional(),
  expectedAST: z.record(z.string(), z.unknown()).describe('Expected ObjectQL AST'),
  
  /** Metadata */
  category: z.string().optional().describe('Example category'),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * NLQ Model Configuration
 */
export const NLQModelConfigSchema = z.object({
  /** Model */
  modelId: z.string().describe('Model from registry'),
  
  /** Prompt Engineering */
  systemPrompt: z.string().optional().describe('System prompt override'),
  includeSchema: z.boolean().default(true).describe('Include object schema in prompt'),
  includeExamples: z.boolean().default(true).describe('Include examples in prompt'),
  
  /** Intent Detection */
  enableIntentDetection: z.boolean().default(true),
  intentThreshold: z.number().min(0).max(1).default(0.7),
  
  /** Entity Recognition */
  enableEntityRecognition: z.boolean().default(true),
  entityRecognitionModel: z.string().optional(),
  
  /** Field Resolution */
  enableFuzzyMatching: z.boolean().default(true).describe('Fuzzy match field names'),
  fuzzyMatchThreshold: z.number().min(0).max(1).default(0.8),
  
  /** Temporal Processing */
  enableTimeframeDetection: z.boolean().default(true),
  defaultTimeframe: z.string().optional().describe('Default timeframe if not specified'),
  
  /** Performance */
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().int().default(3600).describe('Cache TTL in seconds'),
});

/**
 * NLQ Analytics
 */
export const NLQAnalyticsSchema = z.object({
  /** Query Metrics */
  totalQueries: z.number().int(),
  successfulQueries: z.number().int(),
  failedQueries: z.number().int(),
  averageConfidence: z.number().min(0).max(1),
  
  /** Intent Distribution */
  intentDistribution: z.record(z.string(), z.number().int()).describe('Count by intent type'),
  
  /** Common Patterns */
  topQueries: z.array(z.object({
    query: z.string(),
    count: z.number().int(),
    averageConfidence: z.number(),
  })),
  
  /** Performance */
  averageParseTime: z.number().describe('Average parse time in milliseconds'),
  averageExecutionTime: z.number().optional(),
  
  /** Issues */
  lowConfidenceQueries: z.array(z.object({
    query: z.string(),
    confidence: z.number(),
    timestamp: z.string().datetime(),
  })),
  
  /** Timeframe */
  startDate: z.string().datetime().describe('ISO timestamp'),
  endDate: z.string().datetime().describe('ISO timestamp'),
});

/**
 * Field Synonym Configuration
 */
export const FieldSynonymConfigSchema = z.object({
  object: z.string().describe('Object name'),
  field: z.string().describe('Field name'),
  synonyms: z.array(z.string()).describe('Natural language synonyms'),
  examples: z.array(z.string()).optional().describe('Example queries using synonyms'),
});

/**
 * Query Template
 */
export const QueryTemplateSchema = z.object({
  id: z.string(),
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Template name (snake_case)'),
  label: z.string(),
  
  /** Template */
  pattern: z.string().describe('Query pattern with placeholders'),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['object', 'field', 'value', 'timeframe']),
    required: z.boolean().default(false),
  })),
  
  /** Generated AST */
  astTemplate: z.record(z.string(), z.unknown()).describe('AST template with variable placeholders'),
  
  /** Metadata */
  category: z.string().optional(),
  examples: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// Type exports
export type QueryIntent = z.infer<typeof QueryIntentSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Timeframe = z.infer<typeof TimeframeSchema>;
export type NLQFieldMapping = z.infer<typeof NLQFieldMappingSchema>;
export type QueryContext = z.infer<typeof QueryContextSchema>;
export type NLQParseResult = z.infer<typeof NLQParseResultSchema>;
export type NLQRequest = z.infer<typeof NLQRequestSchema>;
export type NLQResponse = z.infer<typeof NLQResponseSchema>;
export type NLQTrainingExample = z.infer<typeof NLQTrainingExampleSchema>;
export type NLQModelConfig = z.infer<typeof NLQModelConfigSchema>;
export type NLQAnalytics = z.infer<typeof NLQAnalyticsSchema>;
export type FieldSynonymConfig = z.infer<typeof FieldSynonymConfigSchema>;
export type QueryTemplate = z.infer<typeof QueryTemplateSchema>;

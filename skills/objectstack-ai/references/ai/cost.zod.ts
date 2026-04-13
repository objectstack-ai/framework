// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * AI Cost Tracking Protocol
 * 
 * Monitor and control AI API costs with budgets, alerts, and analytics.
 * Provides cost optimization, budget enforcement, and financial reporting.
 */

/**
 * Token Usage Schema
 * Standardized across all AI operations
 */
export const TokenUsageSchema = z.object({
  prompt: z.number().int().nonnegative().describe('Input tokens'),
  completion: z.number().int().nonnegative().describe('Output tokens'),
  total: z.number().int().nonnegative().describe('Total tokens'),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * AI Operation Cost Schema
 * Unified cost tracking for all AI operations
 */
export const AIOperationCostSchema = z.object({
  operationId: z.string(),
  operationType: z.enum(['conversation', 'orchestration', 'prediction', 'rag', 'nlq']),
  agentName: z.string().optional().describe('Agent that performed the operation'),
  modelId: z.string(),
  tokens: TokenUsageSchema,
  cost: z.number().nonnegative().describe('Cost in USD'),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AIOperationCost = z.infer<typeof AIOperationCostSchema>;

/**
 * Cost Metric Type
 */
export const CostMetricTypeSchema = z.enum([
  'token',           // Cost per token
  'request',         // Cost per API request
  'character',       // Cost per character (e.g., TTS)
  'second',          // Cost per second (e.g., speech)
  'image',           // Cost per image
  'embedding',       // Cost per embedding
]);

/**
 * Billing Period
 */
export const BillingPeriodSchema = z.enum([
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
]);

/**
 * Cost Entry
 * Extended from AIOperationCostSchema with additional tracking fields
 */
export const CostEntrySchema = z.object({
  /** Identity */
  id: z.string().describe('Unique cost entry ID'),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp'),
  
  /** Request Details */
  modelId: z.string().describe('AI model used'),
  provider: z.string().describe('AI provider (e.g., "openai", "anthropic")'),
  operation: z.string().describe('Operation type (e.g., "chat_completion", "embedding")'),
  
  /** Usage Metrics - Standardized */
  tokens: TokenUsageSchema.optional().describe('Standardized token usage'),
  requestCount: z.number().int().positive().default(1),
  
  /** Cost Calculation */
  promptCost: z.number().nonnegative().optional().describe('Cost of prompt tokens'),
  completionCost: z.number().nonnegative().optional().describe('Cost of completion tokens'),
  totalCost: z.number().nonnegative().describe('Total cost in base currency'),
  currency: z.string().default('USD'),
  
  /** Context */
  sessionId: z.string().optional().describe('Conversation session ID'),
  userId: z.string().optional().describe('User who triggered the request'),
  agentId: z.string().optional().describe('AI agent ID'),
  object: z.string().optional().describe('Related object (e.g., "case", "project")'),
  recordId: z.string().optional().describe('Related record ID'),
  
  /** Metadata */
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Budget Type
 */
export const BudgetTypeSchema = z.enum([
  'global',          // Organization-wide budget
  'user',            // Per-user budget
  'agent',           // Per-agent budget
  'object',          // Per-object budget (e.g., per case)
  'project',         // Per-project budget
  'department',      // Per-department budget
]);

/**
 * Budget Limit
 */
export const BudgetLimitSchema = z.object({
  /** Limit Configuration */
  type: BudgetTypeSchema,
  scope: z.string().optional().describe('Scope identifier (userId, agentId, etc.)'),
  
  /** Limit Amount */
  maxCost: z.number().nonnegative().describe('Maximum cost limit'),
  currency: z.string().default('USD'),
  
  /** Period */
  period: BillingPeriodSchema,
  customPeriodDays: z.number().int().positive().optional().describe('Custom period in days'),
  
  /** Soft Limits & Warnings */
  softLimit: z.number().nonnegative().optional().describe('Soft limit for warnings'),
  warnThresholds: z.array(z.number().min(0).max(1)).optional().describe('Warning thresholds (e.g., [0.5, 0.8, 0.95])'),
  
  /** Enforcement */
  enforced: z.boolean().default(true).describe('Block requests when exceeded'),
  gracePeriodSeconds: z.number().int().nonnegative().default(0).describe('Grace period after limit exceeded'),
  
  /** Rollover */
  allowRollover: z.boolean().default(false).describe('Allow unused budget to rollover'),
  maxRolloverPercentage: z.number().min(0).max(1).optional().describe('Max rollover as % of limit'),
  
  /** Metadata */
  name: z.string().optional().describe('Budget name'),
  description: z.string().optional(),
  active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

/**
 * Budget Status
 */
export const BudgetStatusSchema = z.object({
  /** Budget Reference */
  budgetId: z.string(),
  type: BudgetTypeSchema,
  scope: z.string().optional(),
  
  /** Current Period */
  periodStart: z.string().datetime().describe('ISO 8601 timestamp'),
  periodEnd: z.string().datetime().describe('ISO 8601 timestamp'),
  
  /** Usage */
  currentCost: z.number().nonnegative().default(0),
  maxCost: z.number().nonnegative(),
  currency: z.string().default('USD'),
  
  /** Status */
  percentageUsed: z.number().nonnegative().describe('Usage as percentage (can exceed 1.0 if over budget)'),
  remainingCost: z.number().describe('Remaining budget (can be negative if exceeded)'),
  isExceeded: z.boolean().default(false),
  isWarning: z.boolean().default(false),
  
  /** Projections */
  projectedCost: z.number().nonnegative().optional().describe('Projected cost for period'),
  projectedOverage: z.number().nonnegative().optional().describe('Projected overage'),
  
  /** Last Update */
  lastUpdated: z.string().datetime().describe('ISO 8601 timestamp'),
});

/**
 * Cost Alert Type
 */
export const CostAlertTypeSchema = z.enum([
  'threshold_warning',    // Warning threshold reached
  'threshold_critical',   // Critical threshold reached
  'limit_exceeded',       // Budget limit exceeded
  'anomaly_detected',     // Unusual spending pattern
  'projection_exceeded',  // Projected to exceed budget
]);

/**
 * Cost Alert
 */
export const CostAlertSchema = z.object({
  /** Alert Details */
  id: z.string(),
  timestamp: z.string().datetime().describe('ISO 8601 timestamp'),
  type: CostAlertTypeSchema,
  severity: z.enum(['info', 'warning', 'critical']),
  
  /** Budget Context */
  budgetId: z.string().optional(),
  budgetType: BudgetTypeSchema.optional(),
  scope: z.string().optional(),
  
  /** Alert Information */
  message: z.string().describe('Alert message'),
  currentCost: z.number().nonnegative(),
  maxCost: z.number().nonnegative().optional(),
  threshold: z.number().min(0).max(1).optional(),
  currency: z.string().default('USD'),
  
  /** Recommendations */
  recommendations: z.array(z.string()).optional(),
  
  /** Status */
  acknowledged: z.boolean().default(false),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  resolved: z.boolean().default(false),
  
  /** Metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Cost Breakdown Dimension
 */
export const CostBreakdownDimensionSchema = z.enum([
  'model',
  'provider',
  'user',
  'agent',
  'object',
  'operation',
  'date',
  'hour',
  'tag',
]);

/**
 * Cost Breakdown Entry
 */
export const CostBreakdownEntrySchema = z.object({
  dimension: CostBreakdownDimensionSchema,
  value: z.string().describe('Dimension value (e.g., model ID, user ID)'),
  
  /** Metrics */
  totalCost: z.number().nonnegative(),
  requestCount: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative().optional(),
  
  /** Share */
  percentageOfTotal: z.number().min(0).max(1),
  
  /** Time Range */
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});

/**
 * Cost Analytics
 */
export const CostAnalyticsSchema = z.object({
  /** Time Range */
  periodStart: z.string().datetime().describe('ISO 8601 timestamp'),
  periodEnd: z.string().datetime().describe('ISO 8601 timestamp'),
  
  /** Summary Metrics */
  totalCost: z.number().nonnegative(),
  totalRequests: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative().optional(),
  currency: z.string().default('USD'),
  
  /** Averages */
  averageCostPerRequest: z.number().nonnegative(),
  averageCostPerToken: z.number().nonnegative().optional(),
  averageRequestsPerDay: z.number().nonnegative(),
  
  /** Trends */
  costTrend: z.enum(['increasing', 'decreasing', 'stable']).optional(),
  trendPercentage: z.number().optional().describe('% change vs previous period'),
  
  /** Breakdowns */
  byModel: z.array(CostBreakdownEntrySchema).optional(),
  byProvider: z.array(CostBreakdownEntrySchema).optional(),
  byUser: z.array(CostBreakdownEntrySchema).optional(),
  byAgent: z.array(CostBreakdownEntrySchema).optional(),
  byOperation: z.array(CostBreakdownEntrySchema).optional(),
  byDate: z.array(CostBreakdownEntrySchema).optional(),
  
  /** Top Consumers */
  topModels: z.array(CostBreakdownEntrySchema).optional(),
  topUsers: z.array(CostBreakdownEntrySchema).optional(),
  topAgents: z.array(CostBreakdownEntrySchema).optional(),
  
  /** Efficiency Metrics */
  tokensPerDollar: z.number().nonnegative().optional(),
  requestsPerDollar: z.number().nonnegative().optional(),
});

/**
 * Cost Optimization Recommendation
 */
export const CostOptimizationRecommendationSchema = z.object({
  /** Recommendation Details */
  id: z.string(),
  type: z.enum([
    'switch_model',
    'reduce_tokens',
    'batch_requests',
    'cache_results',
    'adjust_parameters',
    'limit_usage',
  ]),
  
  /** Impact */
  title: z.string(),
  description: z.string(),
  estimatedSavings: z.number().nonnegative().optional(),
  savingsPercentage: z.number().min(0).max(1).optional(),
  
  /** Implementation */
  priority: z.enum(['low', 'medium', 'high']),
  effort: z.enum(['low', 'medium', 'high']),
  actionable: z.boolean().default(true),
  actionSteps: z.array(z.string()).optional(),
  
  /** Context */
  targetModel: z.string().optional(),
  alternativeModel: z.string().optional(),
  affectedUsers: z.array(z.string()).optional(),
  
  /** Status */
  status: z.enum(['pending', 'accepted', 'rejected', 'implemented']).default('pending'),
  implementedAt: z.string().datetime().optional(),
});

/**
 * Cost Report
 */
export const CostReportSchema = z.object({
  /** Report Metadata */
  id: z.string(),
  name: z.string(),
  generatedAt: z.string().datetime().describe('ISO 8601 timestamp'),
  
  /** Time Range */
  periodStart: z.string().datetime().describe('ISO 8601 timestamp'),
  periodEnd: z.string().datetime().describe('ISO 8601 timestamp'),
  period: BillingPeriodSchema,
  
  /** Analytics */
  analytics: CostAnalyticsSchema,
  
  /** Budgets */
  budgets: z.array(BudgetStatusSchema).optional(),
  
  /** Alerts */
  alerts: z.array(CostAlertSchema).optional(),
  activeAlertCount: z.number().int().nonnegative().default(0),
  
  /** Recommendations */
  recommendations: z.array(CostOptimizationRecommendationSchema).optional(),
  
  /** Comparisons */
  previousPeriodCost: z.number().nonnegative().optional(),
  costChange: z.number().optional().describe('Change vs previous period'),
  costChangePercentage: z.number().optional(),
  
  /** Forecasting */
  forecastedCost: z.number().nonnegative().optional(),
  forecastedBudgetStatus: z.enum(['under', 'at', 'over']).optional(),
  
  /** Export */
  format: z.enum(['summary', 'detailed', 'executive']).default('summary'),
  currency: z.string().default('USD'),
});

/**
 * Cost Query Filters
 */
export const CostQueryFiltersSchema = z.object({
  /** Time Range */
  startDate: z.string().datetime().optional().describe('ISO 8601 timestamp'),
  endDate: z.string().datetime().optional().describe('ISO 8601 timestamp'),
  
  /** Dimensions */
  modelIds: z.array(z.string()).optional(),
  providers: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  agentIds: z.array(z.string()).optional(),
  operations: z.array(z.string()).optional(),
  sessionIds: z.array(z.string()).optional(),
  
  /** Cost Range */
  minCost: z.number().nonnegative().optional(),
  maxCost: z.number().nonnegative().optional(),
  
  /** Tags */
  tags: z.array(z.string()).optional(),
  
  /** Aggregation */
  groupBy: z.array(CostBreakdownDimensionSchema).optional(),
  
  /** Sorting */
  orderBy: z.enum(['timestamp', 'cost', 'tokens']).optional().default('timestamp'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  
  /** Pagination */
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

// Type exports
export type CostMetricType = z.infer<typeof CostMetricTypeSchema>;
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;
export type CostEntry = z.infer<typeof CostEntrySchema>;
export type BudgetType = z.infer<typeof BudgetTypeSchema>;
export type BudgetLimit = z.infer<typeof BudgetLimitSchema>;
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;
export type CostAlertType = z.infer<typeof CostAlertTypeSchema>;
export type CostAlert = z.infer<typeof CostAlertSchema>;
export type CostBreakdownDimension = z.infer<typeof CostBreakdownDimensionSchema>;
export type CostBreakdownEntry = z.infer<typeof CostBreakdownEntrySchema>;
export type CostAnalytics = z.infer<typeof CostAnalyticsSchema>;
export type CostOptimizationRecommendation = z.infer<typeof CostOptimizationRecommendationSchema>;
export type CostReport = z.infer<typeof CostReportSchema>;
export type CostQueryFilters = z.infer<typeof CostQueryFiltersSchema>;

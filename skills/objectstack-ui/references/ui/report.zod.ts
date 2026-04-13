// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { FilterConditionSchema } from '../data/filter.zod';
import { ChartConfigSchema } from './chart.zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';
import { ResponsiveConfigSchema, PerformanceConfigSchema } from './responsive.zod';

/**
 * Report Type Enum
 */
export const ReportType = z.enum([
  'tabular',   // Simple list
  'summary',   // Grouped by row
  'matrix',    // Grouped by row and column
  'joined'     // Joined multiple blocks
]);

/**
 * Report Column Schema
 */
export const ReportColumnSchema = z.object({
  field: z.string().describe('Field name'),
  label: I18nLabelSchema.optional().describe('Override label'),
  aggregate: z.enum(['sum', 'avg', 'max', 'min', 'count', 'unique']).optional().describe('Aggregation function'),
  /** Responsive visibility/priority per breakpoint */
  responsive: ResponsiveConfigSchema.optional().describe('Responsive visibility for this column'),
});

/**
 * Report Grouping Schema
 */
export const ReportGroupingSchema = z.object({
  field: z.string().describe('Field to group by'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  dateGranularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional().describe('For date fields'),
});

/**
 * Report Chart Schema
 * Embedded visualization configuration using unified chart taxonomy.
 */
export const ReportChartSchema = ChartConfigSchema.extend({
  /** Report-specific chart configuration */
  xAxis: z.string().describe('Grouping field for X-Axis'),
  yAxis: z.string().describe('Summary field for Y-Axis'),
  groupBy: z.string().optional().describe('Additional grouping field'),
});

/**
 * Report Schema
 * Deep data analysis definition.
 */
export const ReportSchema = z.object({
  /** Identity */
  name: SnakeCaseIdentifierSchema.describe('Report unique name'),
  label: I18nLabelSchema.describe('Report label'),
  description: I18nLabelSchema.optional(),
  
  /** Data Source */
  objectName: z.string().describe('Primary object'),
  
  /** Report Configuration */
  type: ReportType.default('tabular').describe('Report format type'),
  
  columns: z.array(ReportColumnSchema).describe('Columns to display'),
  
  /** Grouping (for Summary/Matrix) */
  groupingsDown: z.array(ReportGroupingSchema).optional().describe('Row groupings'),
  groupingsAcross: z.array(ReportGroupingSchema).optional().describe('Column groupings (Matrix only)'),
  
  /** Filtering (MongoDB-style FilterCondition) */
  filter: FilterConditionSchema.optional().describe('Filter criteria'),
  
  /** Visualization */
  chart: ReportChartSchema.optional().describe('Embedded chart configuration'),

  /** ARIA accessibility attributes */
  aria: AriaPropsSchema.optional().describe('ARIA accessibility attributes'),

  /** Performance optimization settings */
  performance: PerformanceConfigSchema.optional().describe('Performance optimization settings'),
});

/**
 * Report Types
 * 
 * Note: For configuration/definition contexts, use the Input types (e.g., ReportInput)
 * which allow optional fields with defaults to be omitted.
 */
export type Report = z.infer<typeof ReportSchema>;
export type ReportColumn = z.infer<typeof ReportColumnSchema>;
export type ReportGrouping = z.infer<typeof ReportGroupingSchema>;
export type ReportChart = z.infer<typeof ReportChartSchema>;

/**
 * Input Types for Report Configuration
 * Use these when defining reports in configuration files.
 */
export type ReportInput = z.input<typeof ReportSchema>;
export type ReportColumnInput = z.input<typeof ReportColumnSchema>;
export type ReportGroupingInput = z.input<typeof ReportGroupingSchema>;
export type ReportChartInput = z.input<typeof ReportChartSchema>;

/**
 * Report Factory Helper
 */
export const Report = {
  create: (config: ReportInput): Report => ReportSchema.parse(config),
} as const;

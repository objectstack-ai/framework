// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';

/**
 * Unified Chart Type Taxonomy
 * 
 * Shared by Dashboard and Report widgets.
 * Provides a comprehensive set of chart types for data visualization.
 */

/**
 * Chart Type Enum
 * Categorized by visualization purpose
 */
export const ChartTypeSchema = z.enum([
  // Comparison
  'bar',
  'horizontal-bar',
  'column',
  'grouped-bar',
  'stacked-bar',
  'bi-polar-bar',
  
  // Trend
  'line',
  'area',
  'stacked-area',
  'step-line',
  'spline',
  
  // Distribution
  'pie',
  'donut',
  'funnel',
  'pyramid',
  
  // Relationship
  'scatter',
  'bubble',
  
  // Composition
  'treemap',
  'sunburst',
  'sankey',
  'word-cloud',
  
  // Performance
  'gauge',
  'solid-gauge',
  'metric',
  'kpi',
  'bullet',
  
  // Geo
  'choropleth',
  'bubble-map',
  'gl-map',
  
  // Advanced
  'heatmap',
  'radar',
  'waterfall',
  'box-plot',
  'violin',
  'candlestick',
  'stock',
  
  // Tabular
  'table',
  'pivot',
]);

export type ChartType = z.infer<typeof ChartTypeSchema>;

/**
 * Chart Axis Schema
 * Definition for X and Y axes
 */
export const ChartAxisSchema = z.object({
  /** Data field to map to this axis */
  field: z.string().describe('Data field key'),
  
  /** Axis title */
  title: I18nLabelSchema.optional().describe('Axis display title'),

  /** Value formatting (d3-format or similar) */
  format: z.string().optional().describe('Value format string (e.g., "$0,0.00")'),
  
  /** Axis scale settings */
  min: z.number().optional().describe('Minimum value'),
  max: z.number().optional().describe('Maximum value'),
  stepSize: z.number().optional().describe('Step size for ticks'),
  
  /** Appearance */
  showGridLines: z.boolean().default(true),
  position: z.enum(['left', 'right', 'top', 'bottom']).optional().describe('Axis position'),
  
  /** Logarithmic scale */
  logarithmic: z.boolean().default(false),
});

/**
 * Chart Series Schema
 * Defines a single data series in the chart
 */
export const ChartSeriesSchema = z.object({
  /** Field name for values */
  name: z.string().describe('Field name or series identifier'),
  
  /** Display label */
  label: I18nLabelSchema.optional().describe('Series display label'),
  
  /** Series type override (combo charts) */
  type: ChartTypeSchema.optional().describe('Override chart type for this series'),
  
  /** Specific color */
  color: z.string().optional().describe('Series color (hex/rgb/token)'),
  
  /** Stacking group */
  stack: z.string().optional().describe('Stack identifier to group series'),
  
  /** Axis binding */
  yAxis: z.enum(['left', 'right']).default('left').describe('Bind to specific Y-Axis'),
});

/**
 * Chart Annotation Schema
 * Static lines or regions to highlight data
 */
export const ChartAnnotationSchema = z.object({
  type: z.enum(['line', 'region']).default('line'),
  axis: z.enum(['x', 'y']).default('y'),
  value: z.union([z.number(), z.string()]).describe('Start value'),
  endValue: z.union([z.number(), z.string()]).optional().describe('End value for regions'),
  color: z.string().optional(),
  label: I18nLabelSchema.optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).default('dashed'),
});

/**
 * Chart Interaction Schema
 */
export const ChartInteractionSchema = z.object({
  tooltips: z.boolean().default(true),
  zoom: z.boolean().default(false),
  brush: z.boolean().default(false),
  clickAction: z.string().optional().describe('Action ID to trigger on click'),
});

/**
 * Chart Configuration Base
 * Common configuration for all chart types
 */
export const ChartConfigSchema = z.object({
  /** Chart Type */
  type: ChartTypeSchema,
  
  /** Titles */
  title: I18nLabelSchema.optional().describe('Chart title'),
  subtitle: I18nLabelSchema.optional().describe('Chart subtitle'),
  description: I18nLabelSchema.optional().describe('Accessibility description'),
  
  /** Axes Mapping */
  xAxis: ChartAxisSchema.optional().describe('X-Axis configuration'),
  yAxis: z.array(ChartAxisSchema).optional().describe('Y-Axis configuration (support dual axis)'),
  
  /** Series Configuration */
  series: z.array(ChartSeriesSchema).optional().describe('Defined series configuration'),
  
  /** Appearance */
  colors: z.array(z.string()).optional().describe('Color palette'),
  height: z.number().optional().describe('Fixed height in pixels'),
  
  /** Components */
  showLegend: z.boolean().default(true).describe('Display legend'),
  showDataLabels: z.boolean().default(false).describe('Display data labels'),
  
  /** Annotations & Reference Lines */
  annotations: z.array(ChartAnnotationSchema).optional(),
  
  /** Interactions */
  interaction: ChartInteractionSchema.optional(),

  /** ARIA accessibility attributes */
  aria: AriaPropsSchema.optional().describe('ARIA accessibility attributes'),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;
export type ChartAxis = z.infer<typeof ChartAxisSchema>;
export type ChartSeries = z.infer<typeof ChartSeriesSchema>;
export type ChartAnnotation = z.infer<typeof ChartAnnotationSchema>;
export type ChartInteraction = z.infer<typeof ChartInteractionSchema>;

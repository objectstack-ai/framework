// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { ProtectionSchema } from '../shared/protection.zod';
import { MetadataProtectionFields } from '../kernel/metadata-protection.zod';
import { FilterConditionSchema } from '../data/filter.zod';
import { ChartConfigSchema } from './chart.zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';
import { I18nLabelSchema, AriaPropsSchema } from './i18n.zod';
import { ResponsiveConfigSchema, PerformanceConfigSchema } from './responsive.zod';

/**
 * Report Type Enum
 */
import { lazySchema } from '../shared/lazy-schema';
export const ReportType = z.enum([
  'tabular',   // Simple list
  'summary',   // Grouped by row
  'matrix',    // Grouped by row and column
  'joined'     // Joined multiple blocks
]);

/**
 * Report Column Schema
 *
 * @deprecated Unreferenced by the single-form (ADR-0021) report shape — a
 * dataset-bound report selects `values` (measure names) and `rows`/`columns`
 * (dimension names) as `z.array(z.string())`, not `ReportColumn` objects. Kept
 * only as a public type export (objectui re-exports it as `SpecReportColumn`);
 * slated for removal in a future governed prune (liveness #1878/#1890).
 */
export const ReportColumnSchema = lazySchema(() => z.object({
  field: z.string().describe('Field name'),
  label: I18nLabelSchema.optional().describe('Override label'),
  aggregate: z.enum(['sum', 'avg', 'max', 'min', 'count', 'unique']).optional().describe('Aggregation function'),
  /** Responsive visibility/priority per breakpoint */
  responsive: ResponsiveConfigSchema.optional().describe('Responsive visibility for this column'),
}));

/**
 * Report Grouping Schema
 *
 * @deprecated Unreferenced by the single-form (ADR-0021) report shape —
 * grouping is expressed by dataset dimension names in `rows`/`columns`. Kept
 * only as a public type export (objectui re-exports it as `SpecReportGrouping`);
 * slated for removal in a future governed prune (liveness #1878/#1890).
 */
export const ReportGroupingSchema = lazySchema(() => z.object({
  field: z.string().describe('Field to group by'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  dateGranularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional().describe('For date fields'),
}));

/**
 * Report Chart Schema
 *
 * A dataset-bound report chart (ADR-0021): `xAxis`/`yAxis` name the report's
 * bound-dataset **dimension** and **measure** (NOT raw object fields) — the
 * Studio inspector picks them from the dataset's dimension/measure catalogs
 * and objectui's `DatasetReportRenderer` plots them via `useDatasetRows`.
 */
export const ReportChartSchema = lazySchema(() => ChartConfigSchema.extend({
  /** Dataset **dimension** name for the X-axis (from the report's bound dataset). */
  xAxis: z.string().describe('Dataset dimension name for the X-axis (bound-dataset dimension, not a raw field)'),
  /** Dataset **measure** name for the Y-axis (from the report's bound dataset). */
  yAxis: z.string().describe('Dataset measure name for the Y-axis (bound-dataset measure, not a raw field)'),
  /**
   * ⚠️ EXPERIMENTAL — NOT ENFORCED (liveness #1878/#1890). An additional
   * series-split grouping. The dataset-bound `DatasetReportRenderer` plots a
   * single `xAxis`×`yAxis` series and does not read this; only the legacy
   * `ReportViewer` fallback consumed a top-level `groupBy`.
   */
  groupBy: z.string().optional().describe('[EXPERIMENTAL — not enforced] Additional series-split grouping; not read by the dataset-bound report renderer (liveness #1878/#1890)'),
}));

/**
 * Joined Report Block Schema
 *
 * Represents a single sub-report inside a `type: 'joined'` report. Each block
 * is a self-contained, independently-queried report stacked vertically (or
 * arranged in a grid) inside the joined container. Blocks are used for
 * comparative dashboards where each panel is a different slice of the same
 * domain — e.g. "new customers / churned / silent" in a customer-churn
 * report, or "new / qualified / closed" in a lead-funnel report.
 *
 * Blocks may declare their own filter (combined with the container filter
 * via `$and` at render time) and their own grouping / aggregation.
 *
 * Notes for implementers:
 * - `type` defaults to `tabular` — leave a block's type implicit if the
 *   sub-report is just a list. Set explicitly to `summary` or `matrix` for
 *   aggregated blocks.
 * - The schema is intentionally permissive about the column shape: blocks
 *   are not allowed to be themselves `joined` (no recursion).
 */
export const JoinedReportBlockSchema: z.ZodTypeAny = lazySchema(() => z.object({
  /** Stable id for the block (used as react key, telemetry, deeplinks). */
  name: SnakeCaseIdentifierSchema,
  /** Human label shown above the block. Falls back to `name`. */
  label: I18nLabelSchema.optional(),
  /** Optional description rendered below the label. */
  description: I18nLabelSchema.optional(),
  /** Block report type — `joined` is intentionally excluded (no recursion). */
  type: z.enum(['tabular', 'summary', 'matrix']).default('tabular'),
  /** Optional inline chart configuration. */
  chart: ReportChartSchema.optional(),

  /**
   * ADR-0021 — the dataset this block binds to (single-form). The block selects
   * the dataset's measures by name; the legacy inline `objectName` + `columns` +
   * `groupings` query was removed in the cutover.
   */
  dataset: SnakeCaseIdentifierSchema.optional().describe('Dataset name to bind (ADR-0021)'),
  /** Dimension names (from the dataset) to group rows by. Dataset-bound only. */
  rows: z.array(z.string()).optional().describe('Dimension names down (dataset-bound)'),
  /** Dimension names across — matrix blocks pivot rows × columns (ADR-0021 D2). */
  columns: z.array(z.string()).optional().describe('Dimension names across (matrix, dataset-bound)'),
  /** Measure names (from the dataset) to display. Dataset-bound only. */
  values: z.array(z.string()).optional().describe('Measure names to show (dataset-bound)'),
  /** Render-time scope filter, ANDed at query time. Dataset-bound only. */
  runtimeFilter: FilterConditionSchema.optional().describe('Render-time scope filter (dataset-bound)'),
}));

/**
 * Report Schema
 * Deep data analysis definition.
 */
export const ReportSchema = lazySchema(() => z.object({
  /** Identity */
  name: SnakeCaseIdentifierSchema.describe('Report unique name'),
  label: I18nLabelSchema.describe('Report label'),
  description: I18nLabelSchema.optional(),

  /** Report Configuration */
  type: ReportType.default('tabular').describe('Report format type'),

  /**
   * ADR-0021 — the semantic-layer `dataset` this report binds to. The report
   * renders the dataset's named measures grouped by the chosen `rows`
   * dimensions — numbers stay consistent with every other surface using the
   * same dataset. This is the single author-facing analytics shape (the legacy
   * inline `objectName` + `columns` + `groupings` query was removed in the
   * single-form cutover). For a `joined` report, the data lives on `blocks`.
   */
  dataset: SnakeCaseIdentifierSchema.optional().describe('Dataset name to bind (ADR-0021)'),
  /** Dimension names (from the dataset) to group rows by (down axis). */
  rows: z.array(z.string()).optional().describe('Dimension names down'),
  /**
   * Dimension names across (ADR-0021 D2) — a `matrix` report pivots
   * `rows` × `columns` with `values` in the cells. Ignored for other types.
   */
  columns: z.array(z.string()).optional().describe('Dimension names across (matrix)'),
  /** Measure names (from the dataset) to display. */
  values: z.array(z.string()).optional().describe('Measure names to show'),
  /** Render-time scope filter, ANDed at query time. */
  runtimeFilter: FilterConditionSchema.optional().describe('Render-time scope filter'),
  /**
   * ADR-0021 D2 — click an aggregated row/cell to open the underlying
   * records (dataset-backed; the host resolves the dataset's object and
   * dimension→field mapping). Default on; set `false` to disable.
   */
  drilldown: z.boolean().default(true).describe('Click-through to underlying records'),

  /** Visualization */
  chart: ReportChartSchema.optional().describe('Embedded chart configuration'),

  /** ARIA accessibility attributes */
  aria: AriaPropsSchema.optional().describe('ARIA accessibility attributes'),

  /** Performance optimization settings */
  performance: PerformanceConfigSchema.optional().describe('Performance optimization settings'),

  /**
   * Joined report blocks — only meaningful when `type: 'joined'`.
   *
   * A joined report renders multiple independent sub-reports stacked
   * vertically in the same view. Each block declares its own object,
   * columns, groupings and filter. The container-level `filter` is ANDed
   * into every block at query time so a top-level scope (e.g. "this
   * quarter") flows down without per-block duplication.
   *
   * Renderers must ignore `blocks` when `type !== 'joined'`.
   */
  blocks: z.array(JoinedReportBlockSchema).optional().describe('Sub-reports for type=joined'),
  /**
   * ADR-0010 §3.7 — Package-level protection envelope. Package
   * authors declare lock policy here; the loader translates it
   * into the private `_lock` envelope at registration time and
   * strips this block before persistence. See
   * `shared/protection.zod.ts`.
   */
  protection: ProtectionSchema.optional().describe(
    'Package author protection block — lock policy for this report.',
  ),

  // ADR-0010 — runtime protection envelope (internal — set by loader).
  ...MetadataProtectionFields,

}).superRefine((r, ctx) => {
  // ADR-0021 single-form: a report is dataset-bound. A `joined` report carries
  // its data on `blocks` (each block dataset-bound); every other type needs a
  // top-level `dataset` + `values`.
  if (r.type === 'joined') {
    if (!r.blocks || r.blocks.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'a `joined` report needs `blocks`.', path: ['blocks'] });
    }
  } else if (!r.dataset || !r.values || r.values.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'a report needs `dataset` + `values` (measure names).',
      path: ['dataset'],
    });
  }
}));

export type JoinedReportBlock = z.infer<typeof JoinedReportBlockSchema>;
export type JoinedReportBlockInput = z.input<typeof JoinedReportBlockSchema>;

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

/**
 * Type-safe factory for an analytics report. Validates at authoring time via
 * `.parse()` and accepts input-shape config (optional defaults, CEL
 * shorthand) — preferred over a bare `: Report` literal.
 */
export function defineReport(config: z.input<typeof ReportSchema>): Report {
  return ReportSchema.parse(config);
}

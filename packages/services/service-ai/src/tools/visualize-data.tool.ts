// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  AIToolDefinition,
  AnalyticsQuery,
  AnalyticsResult,
  IAnalyticsService,
} from '@objectstack/spec/contracts';
import type { ExecutionContext } from '@objectstack/spec/kernel';
import type { ToolHandler, ToolRegistry, ToolExecutionContext } from './tool-registry.js';

// ---------------------------------------------------------------------------
// Context — injected once at registration time
// ---------------------------------------------------------------------------

/**
 * Services required by the {@link VISUALIZE_DATA_TOOL}.
 *
 * The tool composes the analytics service (semantic aggregation) with the
 * AI stream's `data-*` custom-part channel: it runs an analytical query and
 * emits the chart-ready result back to the client as a `data-chart` part,
 * which the chat UI renders inline with the platform's SDUI `<chart>`
 * component. The model still receives a compact textual summary so it can
 * narrate the answer in prose alongside the rendered chart.
 */
export interface VisualizeDataToolContext {
  /** Analytics / BI service for semantic aggregation (ADR-0021). */
  analytics: IAnalyticsService;
  /** Max number of categories (grouped rows) charted per call. Default 50. */
  maxCategories?: number;
}

/** Aggregation function a measure may request. */
type AggFunction = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';

/** Chart types this tool can emit — a subset the SDUI `<chart>` renderer supports. */
type ChartType =
  | 'bar'
  | 'column'
  | 'horizontal-bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'radar'
  | 'scatter';

/**
 * Translate a {@link ToolExecutionContext} into the ObjectQL
 * {@link ExecutionContext} the analytics service expects — mirrors
 * `data-tools.ts#buildEngineContext` so the chart query is scoped to the
 * same tenant / RLS as the rest of the agent's data access.
 */
function buildAnalyticsContext(ctx?: ToolExecutionContext): ExecutionContext {
  if (ctx?.actor) {
    return {
      userId: ctx.actor.id,
      roles: ctx.actor.roles ?? [],
      permissions: ctx.actor.permissions ?? [],
      isSystem: false,
      ...(ctx.environmentId ? { tenantId: ctx.environmentId } : {}),
      ...(ctx.traceId ? { traceId: ctx.traceId } : {}),
    };
  }
  return { roles: [], permissions: [], isSystem: true };
}

/**
 * Derive the analytics measure key for a `{ function, field }` pair, matching
 * the suffix convention recognised by the analytics service's auto-inferred
 * cube (`inferMeasure` in service-analytics): `count`, `<field>_sum`,
 * `<field>_avg`, `<field>_min`, `<field>_max`, `<field>_count_distinct`.
 *
 * The returned key is BOTH the measure passed to `analytics.query()` and the
 * column name the result rows are keyed by — so it doubles as the chart
 * series `dataKey`.
 */
function measureKey(fn: AggFunction, field?: string): string {
  if (fn === 'count') return 'count';
  const f = (field ?? '').trim();
  if (!f) {
    // sum/avg/min/max/count_distinct require a field; fall back to count so
    // the query still succeeds rather than producing an invalid measure.
    return 'count';
  }
  return `${f}_${fn}`;
}

/** Best-effort human label for a measure when the caller / analytics gives none. */
function defaultMeasureLabel(fn: AggFunction, field?: string): string {
  const pretty = (s: string) =>
    s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (fn === 'count') return 'Count';
  const f = field ? pretty(field) : '';
  const verb: Record<AggFunction, string> = {
    count: 'Count',
    sum: 'Total',
    avg: 'Average',
    min: 'Min',
    max: 'Max',
    count_distinct: 'Distinct',
  };
  return `${verb[fn]} ${f}`.trim();
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

/**
 * Tool advertised to the LLM. The model calls this when a visualisation
 * (rather than a list of records or a number) is the best answer — e.g.
 * "show me sales by region", "chart tasks per status", "trend of signups
 * by month".
 */
export const VISUALIZE_DATA_TOOL: AIToolDefinition = {
  name: 'visualize_data',
  label: 'Visualize Data (Chart)',
  description:
    'Aggregate a data object and render the result as a CHART shown inline in ' +
    'the chat. This is the ONLY tool that draws a chart. You MUST call this — ' +
    'NOT query_records / aggregate_data, and NOT a markdown table — whenever ' +
    'the user asks to chart/plot/graph/visualize/draw data, or to show, ' +
    'compare, or break down a count or sum grouped by a category, or a trend ' +
    'over time. If you already fetched the numbers with another tool, still ' +
    'call visualize_data to render them. After it runs the chart is shown to ' +
    'the user automatically; reply with one or two sentences describing it and ' +
    'do NOT re-print the data as a table. Field names in `dimension`, ' +
    '`measures[].field` and `where` MUST be real fields obtained from ' +
    'describe_object — do NOT guess generic names.',
  parameters: {
    type: 'object',
    properties: {
      objectName: {
        type: 'string',
        description: 'The snake_case name of the object to aggregate (e.g. "task", "crm_account").',
      },
      dimension: {
        type: 'string',
        description:
          'The field to group by — becomes the chart\'s category axis ' +
          '(x-axis for bar/line, slices for pie). Omit only for a single ' +
          'whole-object aggregate.',
      },
      measures: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            function: {
              type: 'string',
              enum: ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'],
              description: 'Aggregation function. Use count with no field to count records.',
            },
            field: {
              type: 'string',
              description: 'Field to aggregate. Required for sum/avg/min/max/count_distinct; omit for count.',
            },
            label: {
              type: 'string',
              description: 'Human-readable series label shown in the legend (optional).',
            },
          },
          required: ['function'],
          additionalProperties: false,
        },
        description: 'One or more measures to plot. Each becomes a series in the chart.',
      },
      chartType: {
        type: 'string',
        enum: ['bar', 'column', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'radar', 'scatter'],
        description:
          'Visualization type. Default "bar". Use line/area for time trends, ' +
          'pie/donut for parts-of-a-whole (single measure), bar/column for comparisons.',
      },
      where: {
        type: 'object',
        description:
          'Filter applied before aggregation. MongoDB-style FilterCondition, ' +
          'same rules as query_records: keys MUST be real field names from ' +
          'describe_object.',
      },
      title: {
        type: 'string',
        description: 'Optional chart title shown above the chart.',
      },
      limit: {
        type: 'number',
        description: 'Max number of categories to chart (default 50).',
      },
    },
    required: ['objectName', 'measures'],
    additionalProperties: false,
  },
};

// Module-level counter giving each emitted chart a stable, unique part id so
// the AI SDK keeps every chart as its own part (vs. reconciling them into one).
// A plain counter is fine — ids only need to be unique within a stream.
let chartSeq = 0;

/**
 * Create the handler for {@link VISUALIZE_DATA_TOOL}.
 *
 * Flow: build an {@link AnalyticsQuery} from the tool args → run it through
 * {@link IAnalyticsService.query} (auto-inferred cube when none is defined)
 * → shape the rows into the SDUI `<chart>` contract → emit a `data-chart`
 * custom part via `ctx.onProgress` so the chat renders it inline → return a
 * compact JSON summary for the model to narrate.
 */
export function createVisualizeDataHandler(ctx: VisualizeDataToolContext): ToolHandler {
  const maxCategories = ctx.maxCategories ?? 50;

  return async (args: Record<string, unknown>, execCtx?: ToolExecutionContext): Promise<string> => {
    const objectName = typeof args.objectName === 'string' ? args.objectName.trim() : '';
    if (!objectName) {
      return JSON.stringify({ error: 'objectName is required' });
    }

    const rawMeasures = Array.isArray(args.measures) ? args.measures : [];
    if (rawMeasures.length === 0) {
      return JSON.stringify({ error: 'At least one measure is required' });
    }

    // Normalise measures → analytics measure keys + series descriptors.
    const measures: Array<{ key: string; fn: AggFunction; field?: string; label: string }> = [];
    for (const m of rawMeasures) {
      if (!m || typeof m !== 'object') continue;
      const mm = m as Record<string, unknown>;
      const fn = mm.function as AggFunction;
      if (!fn) continue;
      const field = typeof mm.field === 'string' ? mm.field.trim() || undefined : undefined;
      const key = measureKey(fn, field);
      const label =
        typeof mm.label === 'string' && mm.label.trim()
          ? mm.label.trim()
          : defaultMeasureLabel(fn, field);
      // De-dup identical measure keys (same fn+field) — they'd collide as columns.
      if (measures.some((x) => x.key === key)) continue;
      measures.push({ key, fn, field, label });
    }
    if (measures.length === 0) {
      return JSON.stringify({ error: 'No valid measures — each measure needs a `function`' });
    }

    const dimension = typeof args.dimension === 'string' ? args.dimension.trim() || undefined : undefined;
    const chartType: ChartType =
      typeof args.chartType === 'string' && args.chartType
        ? (args.chartType as ChartType)
        : 'bar';
    const where =
      args.where && typeof args.where === 'object' && !Array.isArray(args.where)
        ? (args.where as Record<string, unknown>)
        : undefined;
    const limit =
      typeof args.limit === 'number' && args.limit > 0
        ? Math.min(args.limit, maxCategories)
        : maxCategories;
    const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim() : undefined;

    const query: AnalyticsQuery = {
      cube: objectName,
      measures: measures.map((m) => m.key),
      ...(dimension ? { dimensions: [dimension] } : {}),
      ...(where ? { where } : {}),
      limit,
    };

    let result: AnalyticsResult;
    try {
      result = await ctx.analytics.query(query, buildAnalyticsContext(execCtx));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        error: `Analytics query failed: ${message}`,
        hint: 'Verify objectName and field names via describe_object.',
      });
    }

    const rows = Array.isArray(result.rows) ? result.rows : [];

    // Prefer analytics-provided field labels (select option text, measure
    // labels) when present — they read better than our derived defaults.
    const fieldLabel = new Map<string, string>();
    for (const f of result.fields ?? []) {
      if (f?.name && f.label) fieldLabel.set(f.name, f.label);
    }

    const series = measures.map((m) => ({
      dataKey: m.key,
      label: fieldLabel.get(m.key) ?? m.label,
    }));

    // SDUI `<chart>` descriptor — matches ChartRenderer's `schema` contract.
    const chartDescriptor = {
      type: 'chart',
      chartType,
      ...(title ? { title } : {}),
      data: rows,
      ...(dimension ? { xAxisKey: dimension } : {}),
      series,
    };

    // Emit the chart as a custom `data-chart` stream part. With a unique id the
    // client keeps each chart as its own part; chat UIs that don't understand
    // `data-chart` simply ignore it and fall back to the textual summary.
    execCtx?.onProgress?.({
      type: 'data-chart',
      id: `chart-${chartSeq++}`,
      data: chartDescriptor,
    });

    // Compact summary for the model to narrate. Cap the inlined rows so a wide
    // result doesn't blow up the context window — the user already sees the
    // full chart.
    const PREVIEW = 20;
    return JSON.stringify({
      rendered: 'chart',
      chartType,
      object: objectName,
      ...(dimension ? { dimension } : {}),
      measures: series.map((s) => s.dataKey),
      categories: rows.length,
      rows: rows.slice(0, PREVIEW),
      ...(rows.length > PREVIEW ? { note: `Showing first ${PREVIEW} of ${rows.length} rows; the full chart is rendered for the user.` } : {}),
    });
  };
}

/**
 * Register {@link VISUALIZE_DATA_TOOL} on a {@link ToolRegistry}.
 *
 * @example
 * ```ts
 * registerVisualizeDataTool(aiService.toolRegistry, { analytics });
 * ```
 */
export function registerVisualizeDataTool(
  registry: ToolRegistry,
  context: VisualizeDataToolContext,
): void {
  registry.register(VISUALIZE_DATA_TOOL, createVisualizeDataHandler(context));
}

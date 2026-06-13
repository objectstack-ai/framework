// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type { AnalyticsQuery, AnalyticsResult } from '@objectstack/spec/contracts';
import { createVisualizeDataHandler, type VisualizeDataToolContext } from './visualize-data.tool.js';
import type { ToolExecutionContext } from './tool-registry.js';

/**
 * `visualize_data` runs an analytics aggregation and emits the chart-ready
 * result as a `data-chart` custom stream part (via `ctx.onProgress`), while
 * returning a compact textual summary for the model to narrate. These tests
 * pin both halves of that contract.
 */

/** Build a tool context whose analytics service records the query it received. */
function makeCtx(opts: {
  result?: AnalyticsResult;
  onQuery?: (q: AnalyticsQuery) => void;
  throwError?: string;
}): VisualizeDataToolContext {
  return {
    analytics: {
      query: async (q: AnalyticsQuery): Promise<AnalyticsResult> => {
        opts.onQuery?.(q);
        if (opts.throwError) throw new Error(opts.throwError);
        return (
          opts.result ?? {
            rows: [
              { status: 'won', count: 5 },
              { status: 'lost', count: 2 },
            ],
            fields: [
              { name: 'status', type: 'string' },
              { name: 'count', type: 'number', label: 'Count' },
            ],
          }
        );
      },
      getMeta: async () => [],
    } as never,
  };
}

/** Collect the `data-chart` parts emitted through onProgress. */
function makeExecCtx(): { ctx: ToolExecutionContext; parts: Array<{ type: string; id?: string; data?: unknown }> } {
  const parts: Array<{ type: string; id?: string; data?: unknown }> = [];
  const ctx: ToolExecutionContext = {
    onProgress: (p) => parts.push(p),
  };
  return { ctx, parts };
}

describe('visualize_data', () => {
  it('emits a data-chart part shaped for the SDUI <chart> renderer and returns a summary', async () => {
    const handler = createVisualizeDataHandler(makeCtx({}));
    const { ctx, parts } = makeExecCtx();

    const out = JSON.parse(
      (await handler(
        {
          objectName: 'opportunity',
          dimension: 'status',
          measures: [{ function: 'count' }],
          chartType: 'bar',
          title: 'Deals by status',
        },
        ctx,
      )) as string,
    );

    // One data-chart part emitted, carrying the chart descriptor.
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('data-chart');
    expect(parts[0].id).toBeTruthy();
    const chart = parts[0].data as Record<string, any>;
    expect(chart.type).toBe('chart');
    expect(chart.chartType).toBe('bar');
    expect(chart.title).toBe('Deals by status');
    expect(chart.xAxisKey).toBe('status');
    expect(chart.series).toEqual([{ dataKey: 'count', label: 'Count' }]);
    expect(chart.data).toHaveLength(2);

    // Textual summary for the model — names the chart, not a raw table dump.
    expect(out.rendered).toBe('chart');
    expect(out.categories).toBe(2);
    expect(out.measures).toEqual(['count']);
  });

  it('maps function+field to the analytics suffix measure key (amount_sum)', async () => {
    let received: AnalyticsQuery | undefined;
    const handler = createVisualizeDataHandler(
      makeCtx({
        onQuery: (q) => (received = q),
        result: {
          rows: [{ region: 'NA', amount_sum: 1000 }],
          fields: [
            { name: 'region', type: 'string' },
            { name: 'amount_sum', type: 'number' },
          ],
        },
      }),
    );
    const { ctx, parts } = makeExecCtx();

    await handler(
      {
        objectName: 'order',
        dimension: 'region',
        measures: [{ function: 'sum', field: 'amount', label: 'Revenue' }],
        where: { stage: { $ne: 'draft' } },
      },
      ctx,
    );

    expect(received?.cube).toBe('order');
    expect(received?.measures).toEqual(['amount_sum']);
    expect(received?.dimensions).toEqual(['region']);
    expect(received?.where).toEqual({ stage: { $ne: 'draft' } });

    // Series dataKey equals the measure key; the caller's label is preserved.
    const chart = parts[0].data as Record<string, any>;
    expect(chart.series).toEqual([{ dataKey: 'amount_sum', label: 'Revenue' }]);
  });

  it('defaults chartType to bar and supports multiple measures as series', async () => {
    const handler = createVisualizeDataHandler(
      makeCtx({
        result: {
          rows: [{ month: '2026-01', count: 10, amount_sum: 500 }],
          fields: [],
        },
      }),
    );
    const { ctx, parts } = makeExecCtx();

    await handler(
      {
        objectName: 'order',
        dimension: 'month',
        measures: [{ function: 'count' }, { function: 'sum', field: 'amount' }],
      },
      ctx,
    );

    const chart = parts[0].data as Record<string, any>;
    expect(chart.chartType).toBe('bar');
    expect(chart.series.map((s: any) => s.dataKey)).toEqual(['count', 'amount_sum']);
  });

  it('returns a structured error (no chart emitted) when the analytics query fails', async () => {
    const handler = createVisualizeDataHandler(makeCtx({ throwError: 'no such cube' }));
    const { ctx, parts } = makeExecCtx();

    const out = JSON.parse(
      (await handler(
        { objectName: 'ghost', dimension: 'x', measures: [{ function: 'count' }] },
        ctx,
      )) as string,
    );

    expect(parts).toHaveLength(0);
    expect(out.error).toMatch(/Analytics query failed: no such cube/);
  });

  it('rejects calls with no valid measures', async () => {
    const handler = createVisualizeDataHandler(makeCtx({}));
    const { ctx, parts } = makeExecCtx();

    const out = JSON.parse(
      (await handler({ objectName: 'order', measures: [] }, ctx)) as string,
    );
    expect(parts).toHaveLength(0);
    expect(out.error).toMatch(/at least one measure/i);
  });
});

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import type { IAnalyticsService, AnalyticsQuery, AnalyticsResult } from '@objectstack/spec/contracts';
import { DatasetSchema } from '@objectstack/spec/ui';
import { compileDataset } from '../dataset-compiler.js';
import {
  DatasetExecutor,
  evaluateDerivedMeasures,
  combineFilters,
  shiftRange,
} from '../dataset-executor.js';

describe('evaluateDerivedMeasures', () => {
  const rows = [{ region: 'NA', won_amount: 60, total_amount: 100, a: 3, b: 4 }];

  it('computes ratio with div-by-zero → null', () => {
    expect(evaluateDerivedMeasures(rows, [{ name: 'wr', op: 'ratio', of: ['won_amount', 'total_amount'] }])[0].wr).toBe(0.6);
    expect(evaluateDerivedMeasures([{ x: 1, y: 0 }], [{ name: 'r', op: 'ratio', of: ['x', 'y'] }])[0].r).toBeNull();
  });

  it('computes sum / difference / product', () => {
    expect(evaluateDerivedMeasures(rows, [{ name: 's', op: 'sum', of: ['a', 'b'] }])[0].s).toBe(7);
    expect(evaluateDerivedMeasures(rows, [{ name: 'd', op: 'difference', of: ['b', 'a'] }])[0].d).toBe(1);
    expect(evaluateDerivedMeasures(rows, [{ name: 'p', op: 'product', of: ['a', 'b'] }])[0].p).toBe(12);
  });

  it('yields null when an operand is missing', () => {
    expect(evaluateDerivedMeasures([{ a: 1 }], [{ name: 'r', op: 'ratio', of: ['a', 'missing'] }])[0].r).toBeNull();
  });
});

describe('combineFilters', () => {
  it('ANDs two filters, passes through one, undefined for none', () => {
    expect(combineFilters({ a: 1 }, { b: 2 })).toEqual({ $and: [{ a: 1 }, { b: 2 }] });
    expect(combineFilters({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(combineFilters(undefined, undefined)).toBeUndefined();
  });
});

describe('shiftRange', () => {
  it('previousPeriod = equal-length window ending the day before start', () => {
    expect(shiftRange(['2026-01-01', '2026-01-31'], 'previousPeriod')).toEqual(['2025-12-01', '2025-12-31']);
  });
  it('previousYear = same window minus one year', () => {
    expect(shiftRange(['2026-03-01', '2026-03-31'], 'previousYear')).toEqual(['2025-03-01', '2025-03-31']);
  });
});

const dataset = DatasetSchema.parse({
  name: 'sales', label: 'Sales', object: 'opportunity', include: ['account'],
  filter: { is_deleted: { $ne: true } },
  dimensions: [{ name: 'region', field: 'account.region', type: 'string' }],
  measures: [
    { name: 'revenue', aggregate: 'sum', field: 'amount', certified: true },
    { name: 'won_amount', aggregate: 'sum', field: 'amount', filter: { stage: 'won' } },
    { name: 'win_rate', aggregate: 'sum', derived: { op: 'ratio', of: ['won_amount', 'revenue'] } },
  ],
});

function fakeService(handler: (q: AnalyticsQuery) => AnalyticsResult): IAnalyticsService {
  return {
    query: vi.fn(async (q: AnalyticsQuery) => handler(q)),
    getMeta: async () => [],
  };
}

describe('DatasetExecutor', () => {
  it('combines dataset.filter with runtimeFilter and returns aggregated rows', async () => {
    const svc = fakeService((q) => {
      expect(q.cube).toBe('sales');
      expect(q.where).toEqual({ $and: [{ is_deleted: { $ne: true } }, { region: 'NA' }] });
      return { rows: [{ region: 'NA', revenue: 100 }], fields: [{ name: 'revenue', type: 'number' }] };
    });
    const compiled = compileDataset(dataset);
    const res = await new DatasetExecutor(svc).execute(compiled, {
      dimensions: ['region'], measures: ['revenue'], runtimeFilter: { region: 'NA' },
    });
    expect(res.rows).toEqual([{ region: 'NA', revenue: 100 }]);
  });

  it('runs a supplementary query for a measure-scoped filter and merges by dimension', async () => {
    const seen: AnalyticsQuery[] = [];
    const svc = fakeService((q) => {
      seen.push(q);
      if (q.measures.includes('revenue')) return { rows: [{ region: 'NA', revenue: 100 }], fields: [] };
      // won_amount query — scoped with stage=won
      return { rows: [{ region: 'NA', won_amount: 60 }], fields: [] };
    });
    const compiled = compileDataset(dataset);
    const res = await new DatasetExecutor(svc).execute(compiled, {
      dimensions: ['region'], measures: ['revenue', 'won_amount'],
    });
    // measure filter applied
    const wonQuery = seen.find((q) => q.measures.includes('won_amount'))!;
    expect(wonQuery.where).toEqual({ $and: [{ is_deleted: { $ne: true } }, { stage: 'won' }] });
    expect(res.rows[0]).toMatchObject({ region: 'NA', revenue: 100, won_amount: 60 });
  });

  it('evaluates a derived measure from its (filtered + unfiltered) dependencies', async () => {
    const svc = fakeService((q) =>
      q.measures.includes('won_amount')
        ? { rows: [{ region: 'NA', won_amount: 60 }], fields: [] }
        : { rows: [{ region: 'NA', revenue: 100 }], fields: [] },
    );
    const compiled = compileDataset(dataset);
    const res = await new DatasetExecutor(svc).execute(compiled, {
      dimensions: ['region'], measures: ['win_rate'],
    });
    expect(res.rows[0].win_rate).toBe(0.6);
  });

  it('compareTo runs a shifted query and attaches <measure>__compare', async () => {
    const seen: AnalyticsQuery[] = [];
    const svc = fakeService((q) => {
      seen.push(q);
      const isShifted = JSON.stringify(q.timeDimensions).includes('2025-12');
      return { rows: [{ region: 'NA', revenue: isShifted ? 80 : 100 }], fields: [] };
    });
    const compiled = compileDataset(dataset);
    const res = await new DatasetExecutor(svc).execute(compiled, {
      dimensions: ['region'], measures: ['revenue'],
      timeDimensions: [{ dimension: 'close_date', dateRange: ['2026-01-01', '2026-01-31'] }],
      compareTo: { kind: 'previousPeriod', dimension: 'close_date' },
    });
    expect(res.rows[0]).toMatchObject({ region: 'NA', revenue: 100, revenue__compare: 80 });
    // the shifted query used the previous period
    const shifted = seen.find((q) => JSON.stringify(q.timeDimensions).includes('2025-12'))!;
    expect(shifted.timeDimensions![0].dateRange).toEqual(['2025-12-01', '2025-12-31']);
  });
});

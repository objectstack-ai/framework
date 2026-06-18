// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Regression (ADR-0053 Phase 2, #1982): on a SQL driver — where BOTH
// `nativeSql` and `objectqlAggregate` capabilities are advertised (the real
// SQLite/Postgres/MySQL deployment) — a date-bucketed query must route to the
// ObjectQLStrategy so `engine.aggregate` buckets by granularity and honours a
// non-UTC reference timezone (in-memory). NativeSQLStrategy groups by the raw
// column (`GROUP BY <col>`, no `date_trunc`) and ignores `timezone`; because it
// has higher precedence (priority 10 < 20) it silently won every cube/dataset
// query, producing one bucket per row and tz-invariant results. The earlier
// granularity test passed only because it forced `nativeSql: false`, masking
// the real misrouting. This test pins the production capability shape.

import { describe, it, expect } from 'vitest';
import { DatasetSchema } from '@objectstack/spec/ui';
import { AnalyticsService } from '../analytics-service.js';

const dataset = DatasetSchema.parse({
  name: 'pipeline',
  label: 'Pipeline',
  object: 'opportunity',
  dimensions: [
    { name: 'stage', field: 'stage', type: 'string' },
    { name: 'close_date', field: 'close_date', type: 'date' },
  ],
  measures: [{ name: 'opp_count', aggregate: 'count' }],
});

// Mirror a real SQL deployment: native SQL AND objectql aggregate both available.
const PROD_CAPS = { nativeSql: true, objectqlAggregate: true, inMemory: true };

function buildService() {
  const rawSqlCalls: Array<{ sql: string }> = [];
  const aggregateCalls: Array<{ groupBy?: unknown[]; timezone?: string }> = [];
  const svc = new AnalyticsService({
    queryCapabilities: () => PROD_CAPS,
    executeRawSql: async (_object, sql) => {
      rawSqlCalls.push({ sql });
      return [{ 'close_date': '2026-06-17T01:44:15.667Z', opp_count: 1 }];
    },
    executeAggregate: async (_object, options) => {
      aggregateCalls.push({ groupBy: options.groupBy as unknown[], timezone: options.timezone });
      return [{ close_date: '2026-06', opp_count: 6 }];
    },
  });
  return { svc, rawSqlCalls, aggregateCalls };
}

describe('NativeSQLStrategy declines date-granularity queries (regression #1982)', () => {
  it('routes a granularity timeDimension to engine.aggregate, NOT raw SQL', async () => {
    const { svc, rawSqlCalls, aggregateCalls } = buildService();

    await svc.queryDataset!(dataset, {
      dimensions: ['close_date'],
      measures: ['opp_count'],
      timeDimensions: [{ dimension: 'close_date', granularity: 'month' }],
      timezone: 'America/New_York',
    });

    // ObjectQLStrategy handled it (native SQL would have lost the bucket + tz).
    expect(rawSqlCalls).toHaveLength(0);
    expect(aggregateCalls).toHaveLength(1);
    // Bucketed groupBy + reference tz reach the engine.
    expect(aggregateCalls[0].groupBy).toEqual([{ field: 'close_date', dateGranularity: 'month' }]);
    expect(aggregateCalls[0].timezone).toBe('America/New_York');
  });

  it('still uses native SQL for a plain (non-bucketed) query', async () => {
    const { svc, rawSqlCalls, aggregateCalls } = buildService();

    await svc.queryDataset!(dataset, {
      dimensions: ['stage'],
      measures: ['opp_count'],
    });

    // No granularity → native SQL is correct and preferred; we did not over-decline.
    expect(rawSqlCalls).toHaveLength(1);
    expect(aggregateCalls).toHaveLength(0);
  });
});

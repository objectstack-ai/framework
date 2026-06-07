// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { DatasetSchema } from '@objectstack/spec/ui';
import type { ExecutionContext } from '@objectstack/spec/kernel';
import { AnalyticsService } from '../analytics-service.js';

const dataset = DatasetSchema.parse({
  name: 'sales',
  label: 'Sales',
  object: 'opportunity',
  include: ['account'],
  dimensions: [{ name: 'region', field: 'account.region', type: 'string' }],
  measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount', certified: true }],
});

function service(captured: { sql: string; params: unknown[] }[]) {
  return new AnalyticsService({
    queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
    executeRawSql: async (_o, sql, params) => { captured.push({ sql, params }); return [{ region: 'NA', revenue: 100 }]; },
    getReadScope: (_o, ctx?: ExecutionContext) => (ctx?.tenantId ? { organization_id: ctx.tenantId } : undefined),
  });
}

describe('AnalyticsService.queryDataset', () => {
  it('compiles an inline dataset, runs it, and returns rows', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const result = await service(captured).queryDataset(
      dataset,
      { dimensions: ['region'], measures: ['revenue'] },
      { tenantId: 'org_A' } as ExecutionContext,
    );
    expect(result.rows).toEqual([{ region: 'NA', revenue: 100 }]);
  });

  it('auto-wires the join allowlist from the compiled dataset (D-C) — declared join allowed', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await service(captured).queryDataset(dataset, { dimensions: ['region'], measures: ['revenue'] }, { tenantId: 'org_A' } as ExecutionContext);
    // account join present + both tables tenant-scoped, with no getAllowedRelationships config passed.
    expect(captured[0].sql).toContain('LEFT JOIN "account"');
    expect(captured[0].sql).toMatch(/"opportunity"\."organization_id"/);
    expect(captured[0].sql).toMatch(/"account"\."organization_id"/);
  });

  it('rejects an inline dataset whose dimension traverses an undeclared relationship', async () => {
    const bad = DatasetSchema.parse({
      name: 'bad', label: 'Bad', object: 'opportunity', include: [],
      dimensions: [{ name: 'region', field: 'account.region' }],
      measures: [{ name: 'cnt', aggregate: 'count' }],
    });
    await expect(
      service([]).queryDataset(bad, { dimensions: ['region'], measures: ['cnt'] }),
    ).rejects.toThrow(/not declared in the dataset's `include`/);
  });

  it('pre-registered datasets (config.datasets) are compiled at construction', () => {
    const svc = new AnalyticsService({
      datasets: [dataset],
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => [],
    });
    expect(svc.cubeRegistry.has('sales')).toBe(true);
  });
});

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
  measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
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

  it('degrades to an empty result when the backing table is missing (no such table)', async () => {
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => { throw new Error('SELECT COUNT(*) FROM "opportunity" - no such table: opportunity'); },
    });
    const result = await svc.queryDataset(dataset, { dimensions: ['region'], measures: ['revenue'] }, { tenantId: 'org_A' } as ExecutionContext);
    expect(result).toEqual({ rows: [], fields: [], totals: [] });
  });

  it('still throws on a non-missing-source error (real query bugs surface)', async () => {
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => { throw new Error('syntax error near "FROM"'); },
    });
    await expect(
      svc.queryDataset(dataset, { dimensions: ['region'], measures: ['revenue'] }, { tenantId: 'org_A' } as ExecutionContext),
    ).rejects.toThrow(/syntax error/);
  });

  it('pre-registered datasets (config.datasets) are compiled at construction', () => {
    const svc = new AnalyticsService({
      datasets: [dataset],
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => [],
    });
    expect(svc.cubeRegistry.has('sales')).toBe(true);
  });

  // ── ADR-0021 D2 drill-through metadata ──────────────────────────────────
  it('exposes drill-through metadata: object, dimensionFields, and a raw-value sidecar', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const result = await service(captured).queryDataset(
      dataset,
      { dimensions: ['region'], measures: ['revenue'] },
      { tenantId: 'org_A' } as ExecutionContext,
    ) as any;
    // The host drills into the dataset's base object…
    expect(result.object).toBe('opportunity');
    // …mapping the drillable dimension name to its underlying field…
    expect(result.dimensionFields).toEqual({ region: 'account.region' });
    // …and the RAW grouped value is preserved in a parallel array (rows are
    // NOT mutated — they keep exactly their measure/dimension columns).
    expect(result.drillRawRows).toEqual([{ region: 'NA' }]);
    expect(result.rows[0]).toEqual({ region: 'NA', revenue: 100 });
  });

  it('enriches a measure column with its declared currency (ISO 4217)', async () => {
    const priced = DatasetSchema.parse({
      name: 'sales_priced', label: 'Sales', object: 'opportunity', include: [],
      dimensions: [{ name: 'stage', field: 'stage', type: 'string' }],
      measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount', label: 'Revenue', format: '0,0', currency: 'USD' }],
    });
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => [{ stage: 'Won', revenue: 1000 }],
      getReadScope: (_o, ctx?: ExecutionContext) => (ctx?.tenantId ? { organization_id: ctx.tenantId } : undefined),
    });
    const result = await svc.queryDataset(
      priced,
      { dimensions: ['stage'], measures: ['revenue'] },
      { tenantId: 'org_A' } as ExecutionContext,
    ) as any;
    // The measure's declared currency rides onto the result field so the client
    // renders a locale-correct symbol via Intl (not a "$" baked into `format`).
    const revenueField = (result.fields ?? []).find((f: any) => f.name === 'revenue');
    expect(revenueField?.currency).toBe('USD');
    expect(revenueField?.format).toBe('0,0');
  });

  // ── ADR-0053 currency chain (measure → field currencyConfig → tenant ctx) ──
  function pricedSvc(rows: Array<Record<string, unknown>>, measureCurrency?: (o: string, f: string) => { type?: string; defaultCurrency?: string } | undefined) {
    return new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => rows,
      getReadScope: (_o, ctx?: ExecutionContext) => (ctx?.tenantId ? { organization_id: ctx.tenantId } : undefined),
      ...(measureCurrency ? { measureCurrency } : {}),
    });
  }
  const moneyDataset = (measure: Record<string, unknown>) => DatasetSchema.parse({
    name: 'money', label: 'Money', object: 'opportunity', include: [],
    dimensions: [{ name: 'stage', field: 'stage', type: 'string' }],
    measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount', label: 'Revenue', ...measure }],
  });

  it('chain: a currency-FIELD measure (no explicit currency) inherits the field defaultCurrency', async () => {
    const svc = pricedSvc([{ stage: 'Won', revenue: 1000 }], (_o, f) => f === 'amount' ? { type: 'currency', defaultCurrency: 'EUR' } : undefined);
    const r = await svc.queryDataset(moneyDataset({}), { dimensions: ['stage'], measures: ['revenue'] }, { tenantId: 'o' } as ExecutionContext) as any;
    expect(r.fields.find((f: any) => f.name === 'revenue')?.currency).toBe('EUR');
  });

  it('chain: a currency field with no defaultCurrency falls back to the tenant ctx.currency', async () => {
    const svc = pricedSvc([{ stage: 'Won', revenue: 1000 }], (_o, f) => f === 'amount' ? { type: 'currency' } : undefined);
    const r = await svc.queryDataset(moneyDataset({}), { dimensions: ['stage'], measures: ['revenue'] }, { tenantId: 'o', currency: 'GBP' } as ExecutionContext) as any;
    expect(r.fields.find((f: any) => f.name === 'revenue')?.currency).toBe('GBP');
  });

  it('chain: an explicit measure currency wins over the field default and the tenant ctx', async () => {
    const svc = pricedSvc([{ stage: 'Won', revenue: 1000 }], (_o, f) => f === 'amount' ? { type: 'currency', defaultCurrency: 'EUR' } : undefined);
    const r = await svc.queryDataset(moneyDataset({ currency: 'JPY' }), { dimensions: ['stage'], measures: ['revenue'] }, { tenantId: 'o', currency: 'GBP' } as ExecutionContext) as any;
    expect(r.fields.find((f: any) => f.name === 'revenue')?.currency).toBe('JPY');
  });

  it('chain: a NON-currency field measure never gets a currency (even with a tenant default)', async () => {
    const svc = pricedSvc([{ stage: 'Won', revenue: 1000 }], (_o, f) => f === 'amount' ? { type: 'number' } : undefined);
    const r = await svc.queryDataset(moneyDataset({}), { dimensions: ['stage'], measures: ['revenue'] }, { tenantId: 'o', currency: 'USD' } as ExecutionContext) as any;
    expect(r.fields.find((f: any) => f.name === 'revenue')?.currency).toBeUndefined();
  });

  it('enriches dimension columns with their dataset display label', async () => {
    const labeled = DatasetSchema.parse({
      name: 'sales2', label: 'Sales', object: 'opportunity', include: ['account'],
      dimensions: [{ name: 'region', field: 'account.region', type: 'string', label: 'Region' }],
      measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount', label: 'Revenue' }],
    });
    const result = await service([]).queryDataset(
      labeled,
      { dimensions: ['region'], measures: ['revenue'] },
      { tenantId: 'org_A' } as ExecutionContext,
    ) as any;
    const regionField = (result.fields ?? []).find((f: any) => f.name === 'region' || f.name === 'account.region');
    expect(regionField?.label).toBe('Region');
  });

  it('does NOT mark a date dimension drillable (a humanized bucket cannot be exact-matched)', async () => {
    const dated = DatasetSchema.parse({
      name: 'sales3', label: 'Sales', object: 'opportunity', include: [],
      dimensions: [{ name: 'closed', field: 'close_date', type: 'date' }],
      measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
    });
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => [{ closed: 1700000000000, revenue: 100 }],
      getReadScope: (_o, ctx?: ExecutionContext) => (ctx?.tenantId ? { organization_id: ctx.tenantId } : undefined),
    });
    const result = await svc.queryDataset(dated, { dimensions: ['closed'], measures: ['revenue'] }, { tenantId: 'org_A' } as ExecutionContext) as any;
    // No drillable (non-date) dimension → no drill metadata at all.
    expect(result.dimensionFields).toBeUndefined();
    expect(result.object).toBeUndefined();
    expect(result.drillRawRows).toBeUndefined();
  });

  it('marks a LOOKUP dimension drillable, exposing the raw FK for exact-match drill', async () => {
    const byAccount = DatasetSchema.parse({
      name: 'sales_acct', label: 'Sales', object: 'opportunity', include: [],
      dimensions: [{ name: 'account', field: 'account', type: 'lookup', label: 'Account' }],
      measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
    });
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: true, objectqlAggregate: false, inMemory: false }),
      executeRawSql: async () => [{ account: 'acc_123', revenue: 1000 }],
      getReadScope: (_o, ctx?: ExecutionContext) => (ctx?.tenantId ? { organization_id: ctx.tenantId } : undefined),
    });
    const result = await svc.queryDataset(byAccount, { dimensions: ['account'], measures: ['revenue'] }, { tenantId: 'org_A' } as ExecutionContext) as any;
    // A lookup dim IS drillable (unlike a date bucket): its raw FK is exposed so
    // the report drill filters by the stored id, not the resolved display name.
    expect(result.object).toBe('opportunity');
    expect(result.dimensionFields).toEqual({ account: 'account' });
    expect(result.drillRawRows).toEqual([{ account: 'acc_123' }]);
  });

  // ── #3214 — raw-value drill sidecar for totals / subtotal rows ────────────
  it('snapshots raw values for totals rows too (#3214), aligned to result.totals', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const result = await service(captured).queryDataset(
      dataset,
      { dimensions: ['region'], measures: ['revenue'], totals: { groupings: [['region'], []] } },
      { tenantId: 'org_A' } as ExecutionContext,
    ) as any;
    // drillRawTotals[i] ↔ result.totals[i]; drillRawTotals[i][j] ↔ result.totals[i].rows[j].
    expect(result.drillRawTotals).toEqual([
      // The ['region'] subtotal grouping snapshots its drillable dim's raw value…
      [{ region: 'NA' }],
      // …while the grand-total grouping ([]) has no drillable dim → an empty map
      // per row, which keeps index alignment and drills the unfiltered object.
      [{}],
    ]);
    // The data-row sidecar is unchanged (regression guard).
    expect(result.drillRawRows).toEqual([{ region: 'NA' }]);
  });

  it('preserves the raw FK for a subtotal row even after label resolution overwrites it (#3214)', async () => {
    const byAccount = DatasetSchema.parse({
      name: 'sales_matrix', label: 'Sales', object: 'opportunity', include: [],
      dimensions: [
        { name: 'account', field: 'account', type: 'lookup', label: 'Account' },
        { name: 'stage', field: 'stage', type: 'string' },
      ],
      measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
    });
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate: async (_object, { groupBy }) => {
        const g = groupBy ?? [];
        // Main grid: account × stage.
        if (g.includes('stage')) return [
          { account: 'acc1', stage: 'won', revenue: 30 },
          { account: 'acc2', stage: 'won', revenue: 20 },
        ];
        // Per-account subtotal grouping (raw FK values, pre-label).
        if (g.includes('account')) return [
          { account: 'acc1', revenue: 30 },
          { account: 'acc2', revenue: 20 },
        ];
        // Grand total.
        return [{ revenue: 50 }];
      },
      labelResolver: {
        getObjectFields: (obj) => ({
          opportunity: { account: { type: 'lookup', reference: 'crm_account' } },
          crm_account: { name: { type: 'text' } },
        } as Record<string, Record<string, { type?: string; reference?: string }>>)[obj],
        fetchRecordLabels: async (target, ids) => {
          const names: Record<string, string> = { acc1: 'Acme Corp', acc2: 'Globex' };
          const m = new Map<unknown, string>();
          if (target === 'crm_account') for (const id of ids) if (names[String(id)]) m.set(id, names[String(id)]);
          return m;
        },
      },
    });
    const result = await svc.queryDataset(
      byAccount,
      { dimensions: ['account', 'stage'], measures: ['revenue'], totals: { groupings: [['account'], []] } },
      { tenantId: 'org_A' } as ExecutionContext,
    ) as any;
    // The subtotal row now reads the display NAME (label resolution ran on it)…
    expect(result.totals[0].dimensions).toEqual(['account']);
    expect(result.totals[0].rows).toEqual([
      { account: 'Acme Corp', revenue: 30 },
      { account: 'Globex', revenue: 20 },
    ]);
    // …but the sidecar still carries the raw FK id, restricted to the grouping's
    // drillable dim (stage is not part of the ['account'] grouping), so a drill
    // from the subtotal filters by the stored value, not the record name.
    expect(result.drillRawTotals[0]).toEqual([{ account: 'acc1' }, { account: 'acc2' }]);
    // Grand total: no drillable dim → an empty map for its single row.
    expect(result.totals[1].dimensions).toEqual([]);
    expect(result.drillRawTotals[1]).toEqual([{}]);
  });
});

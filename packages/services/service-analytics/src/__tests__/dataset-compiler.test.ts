// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { DatasetSchema } from '@objectstack/spec/ui';
import { compileDataset } from '../dataset-compiler.js';

/** A representative dataset: revenue by account.region (the ADR headline case). */
const salesDataset = DatasetSchema.parse({
  name: 'sales',
  label: 'Sales',
  object: 'opportunity',
  include: ['account'],
  filter: { is_deleted: { $ne: true } },
  dimensions: [
    { name: 'region', label: 'Region', field: 'account.region', type: 'string' },
    { name: 'close_month', label: 'Close Month', field: 'close_date', type: 'date', dateGranularity: 'month' },
  ],
  measures: [
    { name: 'revenue', label: 'Revenue', aggregate: 'sum', field: 'amount', certified: true, format: '$0,0.00' },
    { name: 'deal_count', label: 'Deals', aggregate: 'count', certified: false },
    { name: 'won_amount', label: 'Won', aggregate: 'sum', field: 'amount', certified: false, filter: { stage: 'won' } },
    { name: 'win_rate', label: 'Win Rate', aggregate: 'sum', certified: false, derived: { op: 'ratio', of: ['won_amount', 'revenue'] } },
  ],
});

describe('compileDataset', () => {
  it('compiles a dataset to a Cube with dimensions and measures', () => {
    const { cube } = compileDataset(salesDataset);
    expect(cube.name).toBe('sales');
    expect(cube.sql).toBe('opportunity');

    // Dimension with a relationship path keeps the dotted sql for the join machinery.
    expect(cube.dimensions.region.sql).toBe('account.region');
    expect(cube.dimensions.region.type).toBe('string');

    // Date dimension maps to a `time` Cube dimension with the declared granularity.
    expect(cube.dimensions.close_month.type).toBe('time');
    expect(cube.dimensions.close_month.granularities).toEqual(['month']);

    // sum measure → metric sql is the field; format carried.
    expect(cube.measures.revenue.type).toBe('sum');
    expect(cube.measures.revenue.sql).toBe('amount');
    expect(cube.measures.revenue.format).toBe('$0,0.00');

    // count with no field → sql '*'.
    expect(cube.measures.deal_count.type).toBe('count');
    expect(cube.measures.deal_count.sql).toBe('*');
  });

  it('exposes the declared relationships as the join allowlist (D-C)', () => {
    const { allowedRelationships } = compileDataset(salesDataset);
    expect(allowedRelationships.has('account')).toBe(true);
    expect(allowedRelationships.size).toBe(1);
  });

  it('carries dataset-level and per-measure filters separately', () => {
    const { filter, measureFilters } = compileDataset(salesDataset);
    expect(filter).toEqual({ is_deleted: { $ne: true } });
    expect(measureFilters.won_amount).toEqual({ stage: 'won' });
  });

  it('extracts derived measures into the sidecar (not as Cube metrics)', () => {
    const { cube, derived } = compileDataset(salesDataset);
    expect(cube.measures.win_rate).toBeUndefined();
    expect(derived).toEqual([{ name: 'win_rate', op: 'ratio', of: ['won_amount', 'revenue'] }]);
  });

  it('rejects a dotted field that traverses an undeclared relationship (D-C)', () => {
    const bad = DatasetSchema.parse({
      name: 'bad',
      label: 'Bad',
      object: 'opportunity',
      include: [], // owner did NOT declare `account`
      dimensions: [{ name: 'region', field: 'account.region' }],
      measures: [{ name: 'cnt', aggregate: 'count' }],
    });
    expect(() => compileDataset(bad)).toThrowError(/not declared in the dataset's `include`/);
  });

  it('validates declared relationships against the object graph when a resolver is given', () => {
    const resolver = (obj: string, rel: string) => (obj === 'opportunity' && rel === 'account' ? 'account' : undefined);
    expect(() => compileDataset(salesDataset, resolver)).not.toThrow();

    const withBadInclude = DatasetSchema.parse({ ...salesDataset, include: ['nonexistent'] });
    expect(() => compileDataset(withBadInclude, resolver)).toThrowError(/does not exist on object/);
  });

  it('emits cube.joins with the resolved TARGET TABLE (alias ≠ table for namespaced objects)', () => {
    // lookup field `account` on `opportunity` references object `crm_account`.
    const resolver = (obj: string, rel: string) =>
      obj === 'opportunity' && rel === 'account' ? 'crm_account' : undefined;
    const { cube } = compileDataset(salesDataset, resolver);
    expect(cube.joins?.account?.name).toBe('crm_account');
  });

  it('without a resolver, falls back to the relationship name as the join table', () => {
    const { cube } = compileDataset(salesDataset);
    expect(cube.joins?.account?.name).toBe('account');
  });

  it('rejects v1-unsupported aggregates with a clear error', () => {
    const ds = DatasetSchema.parse({
      name: 'agg',
      label: 'Agg',
      object: 'opportunity',
      dimensions: [],
      measures: [{ name: 'tags', aggregate: 'array_agg', field: 'tag' }],
    });
    expect(() => compileDataset(ds)).toThrowError(/not supported by the v1 dataset runtime/);
  });
});

describe('compileDataset — multi-hop joins (ADR-0071)', () => {
  /** opportunity → account (crm_account) → owner (core_user). All to-one. */
  const chainResolver = (obj: string, rel: string) => {
    const graph: Record<string, Record<string, { object: string; table: string }>> = {
      opportunity: { account: { object: 'account', table: 'crm_account' } },
      account: { owner: { object: 'user', table: 'core_user' } },
    };
    return graph[obj]?.[rel];
  };

  const twoHop = () =>
    DatasetSchema.parse({
      name: 'sales_by_owner_region',
      label: 'Sales by owner region',
      object: 'opportunity',
      include: ['account', 'account.owner'],
      dimensions: [
        { name: 'owner_region', label: 'Owner Region', field: 'account.owner.region', type: 'string' },
      ],
      measures: [{ name: 'revenue', label: 'Revenue', aggregate: 'sum', field: 'amount' }],
    });

  it('emits one join per path prefix, keyed by the full dotted path', () => {
    const { cube } = compileDataset(twoHop(), chainResolver);
    expect(cube.joins?.['account']?.name).toBe('crm_account');
    expect(cube.joins?.['account__owner']?.name).toBe('core_user');
    // The deepest dimension keeps its full dotted sql for the strategy.
    expect(cube.dimensions.owner_region.sql).toBe('account.owner.region');
  });

  it('allowlist is every prefix alias (declared path + intermediates)', () => {
    const { allowedRelationships } = compileDataset(twoHop(), chainResolver);
    expect(allowedRelationships.has('account')).toBe(true);
    expect(allowedRelationships.has('account__owner')).toBe(true);
    expect(allowedRelationships.size).toBe(2);
  });

  it('auto-includes the intermediate hop when only the deep path is declared', () => {
    const ds = DatasetSchema.parse({
      name: 'deep_only',
      label: 'Deep only',
      object: 'opportunity',
      include: ['account.owner'], // intermediate `account` NOT explicitly declared
      dimensions: [{ name: 'owner_region', field: 'account.owner.region', type: 'string' }],
      measures: [{ name: 'cnt', aggregate: 'count' }],
    });
    const { cube, allowedRelationships } = compileDataset(ds, chainResolver);
    expect(cube.joins?.['account']?.name).toBe('crm_account'); // auto-added intermediate
    expect(cube.joins?.['account__owner']?.name).toBe('core_user');
    expect(allowedRelationships.size).toBe(2);
  });

  it('rejects an include path beyond the 3-hop cap at parse time (spec refine)', () => {
    expect(() =>
      DatasetSchema.parse({
        name: 'too_deep',
        label: 'Too deep',
        object: 'opportunity',
        include: ['a.b.c.d'], // 4 hops
        dimensions: [{ name: 'deep_name', field: 'a.b.c.d.name' }],
        measures: [{ name: 'cnt', aggregate: 'count' }],
      }),
    ).toThrowError(/3-hop limit/);
  });

  it('the compiler also rejects an over-deep include path (defense in depth)', () => {
    // Bypass the spec refine to exercise the compiler's OWN guard (for datasets
    // built programmatically, not parsed through the schema).
    const raw = {
      name: 'too_deep',
      label: 'Too deep',
      object: 'opportunity',
      include: ['a.b.c.d'],
      dimensions: [{ name: 'deep_name', label: 'Deep', type: 'string', field: 'a.b.c.d.name' }],
      measures: [{ name: 'cnt', label: 'Count', aggregate: 'count' }],
    } as unknown as Parameters<typeof compileDataset>[0];
    expect(() => compileDataset(raw)).toThrowError(/exceeds the 3-hop limit/);
  });

  it('rejects a deep field whose relationship path was not declared (D-C)', () => {
    const bad = DatasetSchema.parse({
      name: 'bad_deep',
      label: 'Bad deep',
      object: 'opportunity',
      include: ['account'], // declared `account` but NOT `account.owner`
      dimensions: [{ name: 'owner_region', field: 'account.owner.region' }],
      measures: [{ name: 'cnt', aggregate: 'count' }],
    });
    expect(() => compileDataset(bad, chainResolver)).toThrowError(/relationship path "account.owner".*not declared/s);
  });

  it('accepts a resolver that returns a bare table string (object assumed equal)', () => {
    const ds = DatasetSchema.parse({
      name: 'str_resolver',
      label: 'String resolver',
      object: 'opportunity',
      include: ['account.owner'],
      dimensions: [{ name: 'owner_region', field: 'account.owner.region' }],
      measures: [{ name: 'cnt', aggregate: 'count' }],
    });
    // Legacy string-returning resolver: object name == table name at each hop.
    const stringResolver = (_obj: string, rel: string) => rel;
    const { cube } = compileDataset(ds, stringResolver);
    expect(cube.joins?.['account']?.name).toBe('account');
    expect(cube.joins?.['account__owner']?.name).toBe('owner');
  });
});

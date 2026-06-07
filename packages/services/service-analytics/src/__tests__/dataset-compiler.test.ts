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

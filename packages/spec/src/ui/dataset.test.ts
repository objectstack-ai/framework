// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { DatasetSchema, defineDataset } from './dataset.zod';

const base = {
  name: 'sales',
  label: 'Sales',
  object: 'opportunity',
  include: ['account'],
  dimensions: [{ name: 'region', field: 'account.region', type: 'string' as const }],
  measures: [
    { name: 'revenue', aggregate: 'sum' as const, field: 'amount' },
    { name: 'deal_count', aggregate: 'count' as const },
  ],
};

describe('DatasetSchema', () => {
  it('accepts a well-formed dataset', () => {
    const ds = DatasetSchema.parse(base);
    expect(ds.measures[0].name).toBe('revenue');
    expect(ds.object).toBe('opportunity');
  });

  it('rejects a non-count measure with no field', () => {
    expect(() =>
      DatasetSchema.parse({ ...base, measures: [{ name: 'revenue', aggregate: 'sum' }] }),
    ).toThrowError(/requires `field`/);
  });

  it('allows count with no field', () => {
    expect(() =>
      DatasetSchema.parse({ ...base, measures: [{ name: 'total', aggregate: 'count' }] }),
    ).not.toThrow();
  });

  it('rejects duplicate measure names', () => {
    expect(() =>
      DatasetSchema.parse({
        ...base,
        measures: [
          { name: 'revenue', aggregate: 'sum', field: 'amount' },
          { name: 'revenue', aggregate: 'avg', field: 'amount' },
        ],
      }),
    ).toThrowError(/duplicate measure name/);
  });

  it('rejects a derived measure referencing an unknown measure', () => {
    expect(() =>
      DatasetSchema.parse({
        ...base,
        measures: [
          { name: 'revenue', aggregate: 'sum', field: 'amount' },
          { name: 'win_rate', aggregate: 'sum', derived: { op: 'ratio', of: ['won_amount', 'revenue'] } },
        ],
      }),
    ).toThrowError(/references unknown measure/);
  });

  it('rejects a derived measure referencing itself', () => {
    expect(() =>
      DatasetSchema.parse({
        ...base,
        measures: [
          { name: 'revenue', aggregate: 'sum', field: 'amount' },
          { name: 'loop', aggregate: 'sum', derived: { op: 'sum', of: ['loop'] } },
        ],
      }),
    ).toThrowError(/cannot reference itself/);
  });

  it('accepts a valid derived measure', () => {
    expect(() =>
      DatasetSchema.parse({
        ...base,
        measures: [
          { name: 'revenue', aggregate: 'sum', field: 'amount' },
          { name: 'won_amount', aggregate: 'sum', field: 'amount', filter: { stage: 'won' } },
          { name: 'win_rate', aggregate: 'sum', derived: { op: 'ratio', of: ['won_amount', 'revenue'] } },
        ],
      }),
    ).not.toThrow();
  });

  it('defineDataset is an identity helper', () => {
    const d = defineDataset(base);
    expect(d).toBe(base);
  });
});

describe('DatasetSchema — derived measure aggregate optionality', () => {
  // Regression: a derived measure had to carry a meaningless `aggregate` or
  // validation failed, even though `aggregate` is ignored for derived measures.
  it('accepts a derived measure with NO aggregate', () => {
    expect(() =>
      DatasetSchema.parse({
        ...base,
        measures: [
          { name: 'won_amount', aggregate: 'sum', field: 'amount' },
          { name: 'win_rate', derived: { op: 'ratio', of: ['won_amount', 'revenue'] } },
          { name: 'revenue', aggregate: 'sum', field: 'amount' },
        ],
      }),
    ).not.toThrow();
  });

  it('still rejects a NON-derived measure with no aggregate', () => {
    expect(() =>
      DatasetSchema.parse({ ...base, measures: [{ name: 'revenue', field: 'amount' }] }),
    ).toThrowError(/requires `aggregate`/);
  });
});

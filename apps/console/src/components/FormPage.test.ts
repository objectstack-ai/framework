// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Pure-function tests for FormPage helpers. These cover the bulk of
 * the renderer's spec-merging logic — buildSections, readPrefill,
 * normalizeColumns, normalizeOptions — without needing a DOM.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSections,
  normalizeColumns,
  normalizeOptions,
  readPrefill,
} from './FormPage';

describe('normalizeColumns', () => {
  it('passes through valid numeric literals', () => {
    expect(normalizeColumns(1)).toBe(1);
    expect(normalizeColumns(2)).toBe(2);
    expect(normalizeColumns(3)).toBe(3);
    expect(normalizeColumns(4)).toBe(4);
  });

  it('parses numeric strings', () => {
    expect(normalizeColumns('1')).toBe(1);
    expect(normalizeColumns('4')).toBe(4);
  });

  it('defaults to 2 for invalid or missing values', () => {
    expect(normalizeColumns(undefined)).toBe(2);
    expect(normalizeColumns(0)).toBe(2);
    expect(normalizeColumns(5)).toBe(2);
    expect(normalizeColumns('foo')).toBe(2);
  });
});

describe('normalizeOptions', () => {
  it('returns undefined for non-arrays', () => {
    expect(normalizeOptions(undefined)).toBeUndefined();
    expect(normalizeOptions(null)).toBeUndefined();
    expect(normalizeOptions('a,b,c')).toBeUndefined();
  });

  it('maps string options to {value,label}', () => {
    expect(normalizeOptions(['new', 'qualified'])).toEqual([
      { value: 'new', label: 'new' },
      { value: 'qualified', label: 'qualified' },
    ]);
  });

  it('honors {value,label} object shape', () => {
    expect(normalizeOptions([{ value: 'n', label: 'New' }])).toEqual([
      { value: 'n', label: 'New' },
    ]);
  });

  it('falls back to {id,name} when value/label are absent', () => {
    expect(normalizeOptions([{ id: 'x', name: 'X-Ray' }])).toEqual([
      { value: 'x', label: 'X-Ray' },
    ]);
  });
});

describe('buildSections', () => {
  const objectSchema = {
    name: 'lead',
    label: 'Lead',
    fields: {
      first_name: { type: 'text', label: 'First name', required: true },
      email: { type: 'email', label: 'Email', maxLength: 200 },
      status: { type: 'select', label: 'Status', options: ['new', 'qualified'] },
    },
  };

  it('merges section fields with object schema definitions', () => {
    const sections = buildSections(
      {
        type: 'simple',
        sections: [
          {
            label: 'About you',
            columns: 2,
            fields: ['first_name', 'email'],
          },
        ],
      },
      objectSchema,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('About you');
    expect(sections[0].columns).toBe(2);
    expect(sections[0].fields).toEqual([
      expect.objectContaining({ name: 'first_name', label: 'First name', type: 'text', required: true }),
      expect.objectContaining({ name: 'email', label: 'Email', type: 'email', maxLength: 200 }),
    ]);
  });

  it('lets FormField overrides win over object defaults', () => {
    const [section] = buildSections(
      {
        type: 'simple',
        sections: [
          {
            fields: [
              { field: 'first_name', label: 'Given name', required: false, placeholder: 'Ada' },
            ],
          },
        ],
      },
      objectSchema,
    );
    expect(section.fields[0].label).toBe('Given name');
    expect(section.fields[0].required).toBe(false);
    expect(section.fields[0].placeholder).toBe('Ada');
  });

  it('normalizes object schema options through onto the renderable field', () => {
    const [section] = buildSections(
      {
        type: 'simple',
        sections: [{ fields: ['status'] }],
      },
      objectSchema,
    );
    expect(section.fields[0].options).toEqual([
      { value: 'new', label: 'new' },
      { value: 'qualified', label: 'qualified' },
    ]);
  });

  it('falls back to text type when the field is unknown', () => {
    const [section] = buildSections(
      {
        type: 'simple',
        sections: [{ fields: ['mystery'] }],
      },
      objectSchema,
    );
    expect(section.fields[0]).toMatchObject({ name: 'mystery', type: 'text' });
  });

  it('accepts legacy `groups` key as an alias for `sections`', () => {
    const sections = buildSections(
      {
        type: 'simple',
        groups: [{ fields: ['first_name'] }],
      } as any,
      objectSchema,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].fields[0].name).toBe('first_name');
  });
});

describe('readPrefill', () => {
  const fields = [
    { name: 'first_name', label: 'First name', type: 'text', required: false, readonly: false, hidden: false, colSpan: 1 as const },
    { name: 'company', label: 'Company', type: 'text', required: false, readonly: false, hidden: false, colSpan: 1 as const, defaultValue: 'Acme' },
    { name: 'phone', label: 'Phone', type: 'text', required: false, readonly: false, hidden: false, colSpan: 1 as const },
  ];

  it('applies defaultValue from the field definition', () => {
    const out = readPrefill(fields, new URLSearchParams());
    expect(out).toEqual({ company: 'Acme' });
  });

  it('overrides defaults with `prefill_<name>` query params', () => {
    const out = readPrefill(fields, new URLSearchParams('prefill_company=Initech&prefill_first_name=Ada'));
    expect(out).toEqual({ company: 'Initech', first_name: 'Ada' });
  });

  it('ignores prefill params for fields not in the form', () => {
    const out = readPrefill(fields, new URLSearchParams('prefill_unknown=zzz'));
    expect(out).toEqual({ company: 'Acme' });
  });

  it('treats empty-string values as a real prefill', () => {
    const out = readPrefill(fields, new URLSearchParams('prefill_company='));
    expect(out.company).toBe('');
  });
});

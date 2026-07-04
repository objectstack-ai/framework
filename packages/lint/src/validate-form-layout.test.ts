// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  validateFormLayout,
  FORM_FIELD_UNKNOWN,
  FORM_COLSPAN_ABSOLUTE,
} from './validate-form-layout';

const objects = [
  { name: 'contract', fields: { name: {}, amount: {}, status: {}, notes: {} } },
];

describe('validateFormLayout (#2578)', () => {
  it('is clean for a well-formed multi-column form (known fields, no colSpan)', () => {
    const stack = {
      objects,
      views: [
        {
          name: 'contract_form',
          type: 'simple',
          data: { provider: 'object', object: 'contract' },
          sections: [
            { label: 'Basics', columns: 2, fields: ['name', 'amount', { field: 'notes', span: 'full' }] },
          ],
        },
      ],
    };
    expect(validateFormLayout(stack)).toEqual([]);
  });

  it('flags a section field that is not on the bound object', () => {
    const stack = {
      objects,
      views: [
        {
          name: 'contract_form',
          data: { provider: 'object', object: 'contract' },
          sections: [{ columns: 2, fields: ['name', 'ghost_field'] }],
        },
      ],
    };
    const findings = validateFormLayout(stack);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe(FORM_FIELD_UNKNOWN);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('ghost_field');
    expect(findings[0].path).toBe('views[0].sections[0].fields[1]');
  });

  it('discourages absolute colSpan and steers to span', () => {
    const stack = {
      objects,
      views: [
        {
          name: 'contract_form',
          data: { provider: 'object', object: 'contract' },
          sections: [{ columns: 2, fields: ['name', { field: 'amount', colSpan: 2 }] }],
        },
      ],
    };
    const findings = validateFormLayout(stack);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe(FORM_COLSPAN_ABSOLUTE);
    expect(findings[0].hint).toContain("span: 'full'");
    expect(findings[0].path).toBe('views[0].sections[0].fields[1].colSpan');
  });

  it('reports both rules for the same field independently', () => {
    const stack = {
      objects,
      views: [
        {
          name: 'contract_form',
          data: { provider: 'object', object: 'contract' },
          sections: [{ columns: 2, fields: [{ field: 'ghost', colSpan: 3 }] }],
        },
      ],
    };
    const rules = validateFormLayout(stack).map(f => f.rule).sort();
    expect(rules).toEqual([FORM_COLSPAN_ABSOLUTE, FORM_FIELD_UNKNOWN].sort());
  });

  it('skips reference-checking when the bound object cannot be resolved', () => {
    const stack = {
      objects,
      views: [
        {
          name: 'orphan_form',
          data: { provider: 'object', object: 'does_not_exist' },
          sections: [{ columns: 2, fields: ['whatever', { field: 'x', colSpan: 2 }] }],
        },
      ],
    };
    const findings = validateFormLayout(stack);
    // No form-field-unknown (object unresolved), but colSpan is still flagged.
    expect(findings.map(f => f.rule)).toEqual([FORM_COLSPAN_ABSOLUTE]);
  });

  it('ignores non-form views (no sections array)', () => {
    const stack = {
      objects,
      views: [
        { name: 'grid', type: 'grid', data: { object: 'contract' }, columns: ['name', 'ghost'] },
      ],
    };
    expect(validateFormLayout(stack)).toEqual([]);
  });

  it('tolerates an empty / shapeless stack', () => {
    expect(validateFormLayout({})).toEqual([]);
    expect(validateFormLayout({ views: [], objects: [] })).toEqual([]);
  });
});

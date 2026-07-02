// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  validateSemanticRoles,
  FIELD_GROUP_UNDECLARED,
  FIELD_GROUP_EMPTY,
  SEMANTIC_ROLE_FIELD_UNKNOWN,
} from './validate-semantic-roles';

const stack = (objects: unknown) => ({ objects });

describe('validateSemanticRoles (ADR-0085)', () => {
  it('passes a clean object', () => {
    const findings = validateSemanticRoles(stack([{
      name: 'account',
      stageField: 'status',
      highlightFields: ['name', 'status'],
      fieldGroups: [{ key: 'basic', label: 'Basic' }],
      fields: {
        name: { type: 'text', group: 'basic' },
        status: { type: 'select' },
      },
    }]));
    expect(findings).toEqual([]);
  });

  it('flags a Field.group referencing an undeclared group', () => {
    const findings = validateSemanticRoles(stack([{
      name: 'account',
      fieldGroups: [{ key: 'basic', label: 'Basic' }],
      fields: {
        name: { type: 'text', group: 'basic' },
        vat: { type: 'text', group: 'billling' }, // typo
      },
    }]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      rule: FIELD_GROUP_UNDECLARED,
      path: 'objects[0].fields.vat.group',
    });
    expect(findings[0].message).toContain('billling');
  });

  it('flags a declared group no field references', () => {
    const findings = validateSemanticRoles(stack([{
      name: 'account',
      fieldGroups: [
        { key: 'basic', label: 'Basic' },
        { key: 'unused', label: 'Unused' },
      ],
      fields: { name: { type: 'text', group: 'basic' } },
    }]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: FIELD_GROUP_EMPTY });
    expect(findings[0].message).toContain('unused');
  });

  it('flags stageField pointing at a missing field; false is fine', () => {
    const bad = validateSemanticRoles(stack([{
      name: 'lead', stageField: 'pipeline', fields: { status: {} },
    }]));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({ rule: SEMANTIC_ROLE_FIELD_UNKNOWN, path: 'objects[0].stageField' });

    const optedOut = validateSemanticRoles(stack([{
      name: 'lead', stageField: false, fields: { status: {} },
    }]));
    expect(optedOut).toEqual([]);
  });

  it('flags unknown highlightFields entries, including via the compactLayout alias', () => {
    const findings = validateSemanticRoles(stack([{
      name: 'account',
      highlightFields: ['name', 'industy'], // typo
      fields: { name: {}, industry: {} },
    }]));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('industy');

    const aliased = validateSemanticRoles(stack([{
      name: 'account',
      compactLayout: ['ghost'],
      fields: { name: {} },
    }]));
    expect(aliased).toHaveLength(1);
    expect(aliased[0]).toMatchObject({ rule: SEMANTIC_ROLE_FIELD_UNKNOWN });
  });

  it('accepts objects as a name-keyed map and tolerates junk shapes', () => {
    const findings = validateSemanticRoles(stack({
      account: { stageField: 'nope', fields: {} },
    }));
    expect(findings).toHaveLength(1);
    expect(validateSemanticRoles({})).toEqual([]);
    expect(validateSemanticRoles(stack(null))).toEqual([]);
    expect(validateSemanticRoles(stack([null, 'junk', 42]))).toEqual([]);
  });
});

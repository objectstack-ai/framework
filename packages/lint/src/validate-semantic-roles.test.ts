// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  validateSemanticRoles,
  FIELD_GROUP_UNDECLARED,
  FIELD_GROUP_EMPTY,
  FIELD_GROUP_SHADOWED,
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
        // `code` keeps the group visible on detail pages: `name` is the
        // record title (page H1, never in the body) so a name-only group
        // would trip rule (d).
        name: { type: 'text', group: 'basic' },
        code: { type: 'text', group: 'basic' },
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

  it('flags a group fully shadowed by the highlight strip (rule d)', () => {
    // `money`'s only member is also a highlight → detail bodies hide it, so
    // the group never renders on detail pages.
    const findings = validateSemanticRoles(stack([{
      name: 'zoo',
      highlightFields: ['name', 'status', 'amount'],
      fieldGroups: [
        { key: 'basics', label: 'Basics' },
        { key: 'money', label: 'Money' },
      ],
      fields: {
        name: { type: 'text' },
        status: { type: 'select', group: 'basics' },
        code: { type: 'text', group: 'basics' }, // keeps basics visible
        amount: { type: 'number', group: 'money' },
      },
    }]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      rule: FIELD_GROUP_SHADOWED,
      path: 'objects[0].fieldGroups',
    });
    expect(findings[0].message).toContain('money');
    expect(findings[0].message).toContain('amount');
  });

  it('rule d counts the title field as hidden-from-body and respects the 4-entry strip cap', () => {
    // A group holding only the record title never renders in the body even
    // though the title is filtered OUT of the strip.
    const titleOnly = validateSemanticRoles(stack([{
      name: 'doc',
      highlightFields: ['title', 'status'],
      fieldGroups: [{ key: 'head', label: 'Head' }],
      fields: { title: { type: 'text', group: 'head' }, status: { type: 'select' } },
    }]));
    expect(titleOnly.map((f) => f.rule)).toEqual([FIELD_GROUP_SHADOWED]);

    // Entry #5 is beyond the strip (first 4 after the title filter), so a
    // group containing it still renders → clean.
    const beyondCap = validateSemanticRoles(stack([{
      name: 'wide',
      highlightFields: ['name', 'a', 'b', 'c', 'd', 'e'],
      fieldGroups: [{ key: 'tail', label: 'Tail' }],
      fields: {
        name: {}, a: {}, b: {}, c: {}, d: {},
        e: { type: 'text', group: 'tail' },
      },
    }]));
    expect(beyondCap).toEqual([]);

    // Hidden members don't keep a group "visible": a group whose only
    // NON-hidden member is highlighted is still shadowed.
    const hiddenMember = validateSemanticRoles(stack([{
      name: 'mix',
      highlightFields: ['name', 'amount'],
      fieldGroups: [{ key: 'money', label: 'Money' }],
      fields: {
        name: {},
        amount: { type: 'number', group: 'money' },
        legacy: { type: 'text', group: 'money', hidden: true },
      },
    }]));
    expect(hiddenMember.map((f) => f.rule)).toEqual([FIELD_GROUP_SHADOWED]);
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

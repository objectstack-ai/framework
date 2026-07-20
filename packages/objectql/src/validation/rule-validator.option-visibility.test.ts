// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Server-side per-option `visibleWhen` enforcement (objectui#2284).
 *
 * A select/multiselect/radio option may gate itself with a `visibleWhen` CEL
 * predicate. Client-side hiding is UX only, so on write the engine re-evaluates
 * the picked value's predicate against the merged record + `current_user` and
 * rejects a clean FALSE — enforcing both cascade integrity (country → province)
 * and role/context gating. Broken/unbound predicates fail-open.
 */
import { describe, it, expect } from 'vitest';
import { evaluateValidationRules, needsPriorRecord } from './rule-validator.js';
import { ValidationError } from './record-validator.js';

// country → province cascade + a role-gated tier option.
const schema = {
  fields: {
    country: { type: 'select', options: [{ value: 'cn' }, { value: 'us' }] },
    province: {
      type: 'select',
      options: [
        { value: 'zj', visibleWhen: "record.country == 'cn'" },
        { value: 'ca', visibleWhen: "record.country == 'us'" },
        { value: 'other' }, // ungated — always allowed
      ],
    },
    tier: {
      type: 'select',
      options: [
        { value: 'standard' },
        { value: 'admin_only', visibleWhen: "'admin' in current_user.positions" },
      ],
    },
  },
};

describe('per-option visibleWhen — cascade enforcement (insert)', () => {
  it('rejects a province that does not match the chosen country', () => {
    expect(() => evaluateValidationRules(schema, { country: 'us', province: 'zj' }, 'insert')).toThrow(
      ValidationError,
    );
  });
  it('accepts a province valid for the country', () => {
    expect(() => evaluateValidationRules(schema, { country: 'cn', province: 'zj' }, 'insert')).not.toThrow();
  });
  it('accepts an ungated option regardless of the parent', () => {
    expect(() => evaluateValidationRules(schema, { country: 'us', province: 'other' }, 'insert')).not.toThrow();
  });
  it('leaves an unknown value to the enum validator (no visibleWhen match)', () => {
    expect(() => evaluateValidationRules(schema, { country: 'cn', province: 'zzz' }, 'insert')).not.toThrow();
  });
});

describe('per-option visibleWhen — cascade enforcement (update, merged record)', () => {
  it('rejects using the prior country when the patch omits it', () => {
    expect(() =>
      evaluateValidationRules(schema, { province: 'zj' }, 'update', { previous: { country: 'us' } }),
    ).toThrow(ValidationError);
  });
  it('accepts using the prior country when it matches', () => {
    expect(() =>
      evaluateValidationRules(schema, { province: 'zj' }, 'update', { previous: { country: 'cn' } }),
    ).not.toThrow();
  });
  it('does not check a field the patch never wrote', () => {
    // province persisted as 'zj' but country now 'us'; patch touches only `note`.
    expect(() =>
      evaluateValidationRules(schema, { note: 'x' } as any, 'update', {
        previous: { country: 'us', province: 'zj' },
      }),
    ).not.toThrow();
  });
});

describe('per-option visibleWhen — role gating', () => {
  it('rejects an admin-only value for a non-admin', () => {
    expect(() =>
      evaluateValidationRules(schema, { tier: 'admin_only' }, 'insert', {
        currentUser: { id: 'u1', positions: ['sales'] },
      }),
    ).toThrow(ValidationError);
  });
  it('accepts an admin-only value for an admin', () => {
    expect(() =>
      evaluateValidationRules(schema, { tier: 'admin_only' }, 'insert', {
        currentUser: { id: 'u1', positions: ['admin'] },
      }),
    ).not.toThrow();
  });
  it('accepts the ungated standard value for anyone', () => {
    expect(() =>
      evaluateValidationRules(schema, { tier: 'standard' }, 'insert', {
        currentUser: { id: 'u1', positions: ['sales'] },
      }),
    ).not.toThrow();
  });
  it('fails open when current_user is unbound (system write) — predicate faults', () => {
    // `'admin' in current_user.positions` faults with no bound user → allowed through.
    // Authorization gating therefore requires the engine to bind current_user.
    expect(() => evaluateValidationRules(schema, { tier: 'admin_only' }, 'insert')).not.toThrow();
  });
});

describe('per-option visibleWhen — multi-select element-wise', () => {
  const multi = {
    fields: {
      country: { type: 'select', options: [{ value: 'cn' }, { value: 'us' }] },
      provinces: {
        type: 'multiselect',
        options: [
          { value: 'zj', visibleWhen: "record.country == 'cn'" },
          { value: 'gd', visibleWhen: "record.country == 'cn'" },
          { value: 'ca', visibleWhen: "record.country == 'us'" },
        ],
      },
    },
  };
  it('rejects when any selected element is invalid for the parent', () => {
    expect(() => evaluateValidationRules(multi, { country: 'cn', provinces: ['zj', 'ca'] }, 'insert')).toThrow(
      ValidationError,
    );
  });
  it('accepts when every selected element is valid', () => {
    expect(() =>
      evaluateValidationRules(multi, { country: 'cn', provinces: ['zj', 'gd'] }, 'insert'),
    ).not.toThrow();
  });
});

describe('per-option visibleWhen — checkboxes element-wise (objectui#2715)', () => {
  // `checkboxes` is the multi-value sibling of `multiselect`; its gated options
  // must be enforced server-side too (client cascading shipped in objectui#2735).
  const checks = {
    fields: {
      country: { type: 'select', options: [{ value: 'cn' }, { value: 'us' }] },
      provinces: {
        type: 'checkboxes',
        options: [
          { value: 'zj', visibleWhen: "record.country == 'cn'" },
          { value: 'gd', visibleWhen: "record.country == 'cn'" },
          { value: 'ca', visibleWhen: "record.country == 'us'" },
        ],
      },
    },
  };
  it('rejects when any checked element is invalid for the parent', () => {
    expect(() => evaluateValidationRules(checks, { country: 'cn', provinces: ['zj', 'ca'] }, 'insert')).toThrow(
      ValidationError,
    );
  });
  it('accepts when every checked element is valid', () => {
    expect(() =>
      evaluateValidationRules(checks, { country: 'cn', provinces: ['zj', 'gd'] }, 'insert'),
    ).not.toThrow();
  });
  it('accounts for a gated checkboxes option in needsPriorRecord', () => {
    expect(needsPriorRecord(checks)).toBe(true);
  });
});

describe('per-option visibleWhen — value/option type coercion', () => {
  // A numeric option value submitted as a string (a common REST/JSON round-trip)
  // must still hit its gate — matching the enum validator's String(...) compare.
  const numeric = {
    fields: {
      country: { type: 'select', options: [{ value: 'cn' }, { value: 'us' }] },
      zone: {
        type: 'select',
        options: [
          { value: 1, visibleWhen: "record.country == 'cn'" },
          { value: 2, visibleWhen: "record.country == 'us'" },
        ],
      },
    },
  };
  it('gates a numeric option value sent as a string', () => {
    expect(() => evaluateValidationRules(numeric, { country: 'us', zone: '1' }, 'insert')).toThrow(
      ValidationError,
    );
  });
  it('accepts the string form when the gate passes', () => {
    expect(() => evaluateValidationRules(numeric, { country: 'cn', zone: '1' }, 'insert')).not.toThrow();
  });
});

describe('needsPriorRecord accounts for option visibleWhen', () => {
  it('is true when a choice field has a gated option (cascade may reference a prior sibling)', () => {
    expect(needsPriorRecord(schema)).toBe(true);
  });
  it('is false for plain option fields with no visibleWhen', () => {
    expect(needsPriorRecord({ fields: { color: { type: 'select', options: [{ value: 'r' }, { value: 'b' }] } } })).toBe(
      false,
    );
  });
});

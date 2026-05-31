// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  evaluateValidationRules,
  needsPriorRecord,
  legalNextStates,
} from './rule-validator.js';
import { ValidationError } from './record-validator.js';

// Mirrors the showcase Account lifecycle: a re-entrant FSM where a churned
// account can be reactivated but cannot jump straight back to prospect.
const accountSchema = {
  validations: [
    {
      type: 'state_machine' as const,
      name: 'account_lifecycle',
      field: 'status',
      message: 'Invalid account lifecycle transition.',
      transitions: {
        prospect: ['active', 'churned'],
        active: ['churned'],
        churned: ['active'],
      },
    },
  ],
};

describe('state_machine enforcement', () => {
  it('allows a declared transition (churned → active)', () => {
    expect(() =>
      evaluateValidationRules(accountSchema, { status: 'active' }, 'update', {
        previous: { status: 'churned' },
      }),
    ).not.toThrow();
  });

  it('rejects an undeclared transition (active → prospect)', () => {
    expect(() =>
      evaluateValidationRules(accountSchema, { status: 'prospect' }, 'update', {
        previous: { status: 'active' },
      }),
    ).toThrow(ValidationError);
  });

  it('surfaces the rule message and an invalid_transition code', () => {
    try {
      evaluateValidationRules(accountSchema, { status: 'prospect' }, 'update', {
        previous: { status: 'churned' },
      });
      throw new Error('expected throw');
    } catch (e) {
      const err = e as ValidationError;
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.fields[0].code).toBe('invalid_transition');
      expect(err.fields[0].field).toBe('status');
      expect(err.fields[0].message).toBe('Invalid account lifecycle transition.');
    }
  });

  it('is a no-op when the state field is unchanged', () => {
    expect(() =>
      evaluateValidationRules(accountSchema, { status: 'active', name: 'X' }, 'update', {
        previous: { status: 'active' },
      }),
    ).not.toThrow();
  });

  it('is a no-op when the PATCH does not touch the state field', () => {
    expect(() =>
      evaluateValidationRules(accountSchema, { name: 'renamed' }, 'update', {
        previous: { status: 'active' },
      }),
    ).not.toThrow();
  });

  it('does not enforce transitions on insert (no prior state)', () => {
    expect(() =>
      evaluateValidationRules(accountSchema, { status: 'churned' }, 'insert'),
    ).not.toThrow();
  });

  it('is lenient when the prior state is not described by the FSM', () => {
    expect(() =>
      evaluateValidationRules(accountSchema, { status: 'active' }, 'update', {
        previous: { status: 'legacy_unknown' },
      }),
    ).not.toThrow();
  });
});

describe('execution control', () => {
  it('skips inactive rules', () => {
    const schema = {
      validations: [{ ...accountSchema.validations[0], active: false }],
    };
    expect(() =>
      evaluateValidationRules(schema, { status: 'prospect' }, 'update', {
        previous: { status: 'active' },
      }),
    ).not.toThrow();
  });

  it('skips rules whose events do not include the write context', () => {
    const schema = {
      validations: [{ ...accountSchema.validations[0], events: ['insert' as const] }],
    };
    expect(() =>
      evaluateValidationRules(schema, { status: 'prospect' }, 'update', {
        previous: { status: 'active' },
      }),
    ).not.toThrow();
  });

  it('treats warning severity as non-blocking', () => {
    const schema = {
      validations: [{ ...accountSchema.validations[0], severity: 'warning' as const }],
    };
    expect(() =>
      evaluateValidationRules(schema, { status: 'prospect' }, 'update', {
        previous: { status: 'active' },
      }),
    ).not.toThrow();
  });
});

describe('script / cross_field predicates', () => {
  const projectSchema = {
    validations: [
      {
        type: 'cross_field' as const,
        name: 'end_after_start',
        fields: ['start_date', 'end_date'],
        condition: { dialect: 'cel', source: 'has(record.start_date) && has(record.end_date) && record.end_date < record.start_date' },
        message: 'End must be on or after start.',
      },
    ],
  };

  it('rejects when the failure predicate is true (end before start)', () => {
    expect(() =>
      evaluateValidationRules(
        projectSchema,
        { end_date: '2026-01-01' },
        'update',
        { previous: { start_date: '2026-06-01', end_date: '2026-12-01' } },
      ),
    ).toThrow(ValidationError);
  });

  it('allows when the predicate is false (merged record honours unchanged fields)', () => {
    expect(() =>
      evaluateValidationRules(
        projectSchema,
        { end_date: '2026-12-01' },
        'update',
        { previous: { start_date: '2026-06-01', end_date: '2026-07-01' } },
      ),
    ).not.toThrow();
  });

  it('fails open (no throw) on an un-evaluable predicate', () => {
    const schema = {
      validations: [
        {
          type: 'script' as const,
          name: 'broken',
          condition: { dialect: 'cel', source: 'this is not valid ((' },
          message: 'broken rule',
        },
      ],
    };
    expect(() =>
      evaluateValidationRules(schema, { a: 1 }, 'update', { previous: { a: 0 } }),
    ).not.toThrow();
  });
});

describe('introspection', () => {
  it('legalNextStates returns the declared targets', () => {
    expect(legalNextStates(accountSchema, 'status', 'prospect')).toEqual(['active', 'churned']);
    expect(legalNextStates(accountSchema, 'status', 'active')).toEqual(['churned']);
  });

  it('legalNextStates returns [] for a known dead-end state, null for no FSM', () => {
    const deadEnd = {
      validations: [
        { type: 'state_machine' as const, name: 'f', field: 'status', message: 'm', transitions: { done: [] } },
      ],
    };
    expect(legalNextStates(deadEnd, 'status', 'done')).toEqual([]);
    expect(legalNextStates(accountSchema, 'other_field', 'x')).toBeNull();
    expect(legalNextStates({ validations: [] }, 'status', 'x')).toBeNull();
  });

  it('needsPriorRecord detects rules that require prior state', () => {
    expect(needsPriorRecord(accountSchema)).toBe(true);
    expect(needsPriorRecord({ validations: [{ type: 'unique', name: 'u', message: 'm', fields: ['x'] }] })).toBe(false);
    expect(needsPriorRecord({ validations: [] })).toBe(false);
    expect(needsPriorRecord(undefined)).toBe(false);
  });
});

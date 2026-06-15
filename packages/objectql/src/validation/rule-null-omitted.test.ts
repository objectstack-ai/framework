// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * #1871 — a `record.<field> == null` predicate must fire on INSERT when the
 * optional field is omitted entirely from the payload (key absent), the same
 * way it fires when the field is explicitly `null`. Before the fix the CEL
 * `record` scope on insert lacked the key, so `record.x == null` could not match.
 */
import { describe, it, expect } from 'vitest';
import { evaluateValidationRules } from './rule-validator';

const schema = {
  fields: {
    priority: { name: 'priority', label: 'Priority', type: 'text' },
    due_date: { name: 'due_date', label: 'Due', type: 'date' },
  },
  validations: [
    {
      name: 'urgent_needs_due',
      type: 'script',
      condition: 'record.priority == "urgent" && record.due_date == null',
      message: 'Urgent tasks require a due date',
      events: ['insert', 'update'],
    },
  ],
} as any;

describe('validation: `field == null` on insert with omitted field (#1871)', () => {
  it('fires when due_date is OMITTED from the insert payload', () => {
    expect(() => evaluateValidationRules(schema, { priority: 'urgent' }, 'insert', {}))
      .toThrow(/rule_violation|_record|Validation failed/);
  });

  it('fires when due_date is explicitly null (already worked)', () => {
    expect(() => evaluateValidationRules(schema, { priority: 'urgent', due_date: null }, 'insert', {}))
      .toThrow(/rule_violation|_record|Validation failed/);
  });

  it('does NOT fire when due_date is present', () => {
    expect(() => evaluateValidationRules(schema, { priority: 'urgent', due_date: '2026-01-01' }, 'insert', {}))
      .not.toThrow();
  });

  it('does NOT fire when priority is not urgent', () => {
    expect(() => evaluateValidationRules(schema, { priority: 'low' }, 'insert', {}))
      .not.toThrow();
  });
});

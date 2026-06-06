// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { validateRecord } from './record-validator.js';

/**
 * Required-field validation, with the autonumber exemption (#1603).
 *
 * `autonumber` values are runtime-owned — the SQL driver assigns them from a
 * persistent sequence AFTER record-validation runs — so a missing value on an
 * insert must NOT be reported as a client "required" error.
 */
describe('validateRecord — required + autonumber exemption', () => {
  const schema = {
    fields: {
      title: { type: 'text', required: true },
      record_no: { type: 'autonumber', required: true, format: 'REC-{0000}' },
    },
  };

  it('does NOT reject a missing required autonumber on insert', () => {
    // title supplied, record_no omitted → only the autonumber is missing.
    expect(() => validateRecord(schema, { title: 'Hello' }, 'insert')).not.toThrow();
  });

  it('still rejects a missing required NON-autonumber field on insert', () => {
    expect(() => validateRecord(schema, { record_no: 'REC-0001' }, 'insert')).toThrow(/title/i);
  });

  it('accepts an explicitly-provided autonumber value', () => {
    expect(() =>
      validateRecord(schema, { title: 'Hello', record_no: 'REC-0042' }, 'insert'),
    ).not.toThrow();
  });
});

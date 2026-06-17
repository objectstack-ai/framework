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

/**
 * `Field.time` is a wall-clock time-of-day, not an instant. The old validator
 * reused the date/datetime branch (`Date.parse`), which is `NaN` for every
 * bare time string — so a `time` field rejected ALL valid values (found
 * driving the showcase field-zoo). It must accept `HH:MM` / `HH:MM:SS`.
 */
describe('validateRecord — time field accepts time-of-day', () => {
  const schema = { fields: { at: { type: 'time' } } };

  for (const v of ['14:30', '09:05:30', '23:59', '00:00:00', '14:30:00Z', '14:30:00.500', '08:15:00+02:00']) {
    it(`accepts ${v}`, () => {
      expect(() => validateRecord(schema, { at: v }, 'insert')).not.toThrow();
    });
  }

  it('accepts a full ISO datetime for a time field (lenient)', () => {
    expect(() => validateRecord(schema, { at: '2026-06-17T14:30:00Z' }, 'insert')).not.toThrow();
  });

  for (const v of ['25:00', '14:60', 'not-a-time', '14']) {
    it(`rejects ${v}`, () => {
      expect(() => validateRecord(schema, { at: v }, 'insert')).toThrow(/invalid_time/i);
    });
  }

  it('does NOT regress date/datetime (still ISO-parsed)', () => {
    const ds = { fields: { d: { type: 'date' }, dt: { type: 'datetime' } } };
    expect(() => validateRecord(ds, { d: '2026-06-17', dt: '2026-06-17T10:00:00Z' }, 'insert')).not.toThrow();
    expect(() => validateRecord(ds, { d: 'not-a-date' }, 'insert')).toThrow(/invalid_date/i);
  });
});

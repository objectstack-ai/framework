// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  EXTERNAL_ERROR_CODES,
  renderDiffMessage,
  ExternalSchemaMismatchError,
  ExternalWriteForbiddenError,
  ExternalSchemaModeViolationError,
  type SchemaDiffEntry,
} from './external-errors';

describe('External error codes (ADR-0015)', () => {
  it('exposes stable codes', () => {
    expect(EXTERNAL_ERROR_CODES.schemaMismatch).toBe('EXTERNAL_SCHEMA_MISMATCH');
    expect(EXTERNAL_ERROR_CODES.writeForbidden).toBe('EXTERNAL_WRITE_FORBIDDEN');
    expect(EXTERNAL_ERROR_CODES.schemaModeViolation).toBe('EXTERNAL_SCHEMA_MODE_VIOLATION');
  });
});

describe('renderDiffMessage', () => {
  it('renders a header with no entries', () => {
    const msg = renderDiffMessage('warehouse', 'wh_order', []);
    expect(msg).toContain("Object 'wh_order'");
    expect(msg).toContain("datasource 'warehouse'");
    expect(msg.split('\n')).toHaveLength(1);
  });

  it('renders one line per diff entry with type detail', () => {
    const diffs: SchemaDiffEntry[] = [
      { kind: 'missing_column', remoteSchema: 'mart', remoteName: 'fact_orders', column: 'amount', severity: 'error' },
      {
        kind: 'type_mismatch',
        remoteSchema: 'mart',
        remoteName: 'fact_orders',
        column: 'ordered_at',
        expected: 'datetime',
        actual: 'text',
        severity: 'warning',
      },
    ];
    const lines = renderDiffMessage('warehouse', 'wh_order', diffs).split('\n');
    expect(lines).toHaveLength(3); // header + 2 entries
    expect(lines[1]).toContain('missing_column');
    expect(lines[1]).toContain('mart.fact_orders.amount');
    expect(lines[2]).toContain('type_mismatch');
    expect(lines[2]).toContain('expected datetime');
    expect(lines[2]).toContain('actual text');
  });
});

describe('ExternalSchemaMismatchError', () => {
  it('carries code, datasource, object, diffs and a rendered message', () => {
    const diffs: SchemaDiffEntry[] = [
      { kind: 'missing_table', remoteName: 'fact_orders', severity: 'error' },
    ];
    const err = new ExternalSchemaMismatchError('warehouse', 'wh_order', diffs);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('EXTERNAL_SCHEMA_MISMATCH');
    expect(err.name).toBe('ExternalSchemaMismatchError');
    expect(err.datasource).toBe('warehouse');
    expect(err.object).toBe('wh_order');
    expect(err.diffs).toBe(diffs);
    expect(err.message).toContain('missing_table');
  });
});

describe('ExternalWriteForbiddenError', () => {
  it('has a stable code and a default message', () => {
    const err = new ExternalWriteForbiddenError();
    expect(err.code).toBe('EXTERNAL_WRITE_FORBIDDEN');
    expect(err.name).toBe('ExternalWriteForbiddenError');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('accepts a custom message', () => {
    const err = new ExternalWriteForbiddenError('nope');
    expect(err.message).toBe('nope');
  });
});

describe('ExternalSchemaModeViolationError', () => {
  it('has a stable code and a default message', () => {
    const err = new ExternalSchemaModeViolationError();
    expect(err.code).toBe('EXTERNAL_SCHEMA_MODE_VIOLATION');
    expect(err.name).toBe('ExternalSchemaModeViolationError');
    expect(err.message.length).toBeGreaterThan(0);
  });
});

// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  deriveRecordSurface,
  countAuthorableFields,
  RECORD_SURFACE_PAGE_THRESHOLD,
} from './record-surface';

/** Build an object def with `n` plain text fields named f0..f(n-1). */
function objWithFields(n: number, extra: Record<string, unknown> = {}) {
  const fields: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) fields[`f${i}`] = { type: 'text', label: `F${i}` };
  return { name: 'thing', fields: { ...fields, ...extra } };
}

describe('deriveRecordSurface (ADR-0085 §5)', () => {
  it('opens a light object as a drawer (below threshold)', () => {
    expect(deriveRecordSurface(objWithFields(3))).toBe('drawer');
    expect(deriveRecordSurface(objWithFields(RECORD_SURFACE_PAGE_THRESHOLD - 1))).toBe('drawer');
  });

  it('opens a field-heavy object as a full page (at/above threshold)', () => {
    expect(deriveRecordSurface(objWithFields(RECORD_SURFACE_PAGE_THRESHOLD))).toBe('page');
    expect(deriveRecordSurface(objWithFields(60))).toBe('page');
  });

  it('forces a full page on mobile regardless of field count', () => {
    expect(deriveRecordSurface(objWithFields(1), { viewport: 'mobile' })).toBe('page');
    expect(deriveRecordSurface(objWithFields(60), { viewport: 'mobile' })).toBe('page');
  });

  it('honours an explicit pageThreshold override', () => {
    expect(deriveRecordSurface(objWithFields(5), { pageThreshold: 4 })).toBe('page');
    expect(deriveRecordSurface(objWithFields(5), { pageThreshold: 20 })).toBe('drawer');
  });

  it('does not count hidden or audit/system fields toward "heavy"', () => {
    const def = objWithFields(RECORD_SURFACE_PAGE_THRESHOLD - 1, {
      created_at: { type: 'datetime' },
      updated_at: { type: 'datetime' },
      organization_id: { type: 'text' },
      secret: { type: 'text', hidden: true },
    });
    // Still below threshold: the 4 extra fields are all system/hidden.
    expect(deriveRecordSurface(def)).toBe('drawer');
  });

  it('tolerates bare / malformed input', () => {
    expect(deriveRecordSurface(null)).toBe('drawer');
    expect(deriveRecordSurface(undefined)).toBe('drawer');
    expect(deriveRecordSurface({})).toBe('drawer');
    expect(deriveRecordSurface({ fields: 'nope' } as unknown)).toBe('drawer');
  });
});

describe('countAuthorableFields', () => {
  it('counts visible non-system fields only', () => {
    expect(countAuthorableFields(objWithFields(5))).toBe(5);
    const def = objWithFields(2, {
      created_by: { type: 'text' },
      hidden_one: { type: 'text', hidden: true },
    });
    expect(countAuthorableFields(def)).toBe(2);
  });

  it('returns 0 for bare/malformed input', () => {
    expect(countAuthorableFields(null)).toBe(0);
    expect(countAuthorableFields({})).toBe(0);
  });
});

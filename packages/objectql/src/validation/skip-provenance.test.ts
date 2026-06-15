// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * #1592 — `validateRecord` skipped required-checks for any field literally named
 * `organization_id` / `tenant_id`. That's correct only for ENGINE-INJECTED tenant
 * columns (already marked `system: true`); a genuinely declared, required business
 * field with that name was silently bypassed → reached the DB as NULL. Skip by
 * provenance (`def.system` / `def.readonly`), never by hardcoded name.
 */
import { describe, it, expect } from 'vitest';
import { validateRecord, ValidationError } from './record-validator';

describe('validateRecord provenance-aware skip (#1592)', () => {
  it('enforces required on a DECLARED business organization_id (not system)', () => {
    const schema: any = { name: 'sys_team', fields: {
      name: { type: 'text', required: true },
      organization_id: { type: 'lookup', reference: 'sys_organization', required: true },
    } };
    let caught: any;
    try { validateRecord(schema, { name: 'x' }, 'insert'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught.fields.some((f: any) => f.field === 'organization_id' && f.code === 'required')).toBe(true);
  });

  it('still skips an INJECTED system organization_id (system: true)', () => {
    const schema: any = { name: 'normal', fields: {
      name: { type: 'text', required: true },
      organization_id: { type: 'lookup', reference: 'sys_organization', required: false, system: true, readonly: true },
    } };
    expect(() => validateRecord(schema, { name: 'x' }, 'insert')).not.toThrow();
  });

  it('enforces required on a declared tenant_id too', () => {
    const schema: any = { name: 't', fields: {
      name: { type: 'text', required: true },
      tenant_id: { type: 'text', required: true },
    } };
    expect(() => validateRecord(schema, { name: 'x' }, 'insert')).toThrow(ValidationError);
  });
});

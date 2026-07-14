// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  validateCapabilityReferences,
  CAPABILITY_REFERENCE_UNKNOWN,
} from './validate-capability-references';

describe('validateCapabilityReferences (ADR-0066 ⑨)', () => {
  it('passes a reference to a built-in platform capability', () => {
    const findings = validateCapabilityReferences({
      objects: [{ name: 'sys_license', requiredPermissions: ['manage_platform_settings'] }],
    });
    expect(findings).toEqual([]);
  });

  it('passes a reference to a capability the stack DECLARES via defineCapability', () => {
    const findings = validateCapabilityReferences({
      capabilities: [{ name: 'export_data', label: 'Export Data', scope: 'org' }],
      objects: [{ name: 'inv_invoice', requiredPermissions: ['export_data'] }],
    });
    expect(findings).toEqual([]);
  });

  it('passes a reference to a capability the stack grants via systemPermissions', () => {
    const findings = validateCapabilityReferences({
      permissions: [{ name: 'billing_admin', systemPermissions: ['manage_billing'] }],
      objects: [{ name: 'inv_invoice', requiredPermissions: ['manage_billing'] }],
    });
    expect(findings).toEqual([]);
  });

  it('passes a reference to a capability shipped as a sys_capability seed row', () => {
    const findings = validateCapabilityReferences({
      data: [{ object: 'sys_capability', records: [{ name: 'approve_invoice' }] }],
      objects: [{ name: 'inv_invoice', requiredPermissions: ['approve_invoice'] }],
    });
    expect(findings).toEqual([]);
  });

  it('warns on an object requiredPermissions typo (registered nowhere)', () => {
    const findings = validateCapabilityReferences({
      objects: [{ name: 'sys_license', requiredPermissions: ['mange_users'] }],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'warning',
      rule: CAPABILITY_REFERENCE_UNKNOWN,
      where: 'object "sys_license"',
      path: 'objects[0].requiredPermissions',
    });
    expect(findings[0].message).toContain('mange_users');
  });

  it('warns per operation for the per-operation map form (ADR-0066 ⑤) and points at the slice', () => {
    const findings = validateCapabilityReferences({
      objects: [{
        name: 'inv_invoice',
        requiredPermissions: { read: ['manage_metadata'], update: ['mange_invoices'] },
      }],
    });
    // `manage_metadata` is built-in → ok; only the `update` typo warns.
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ path: 'objects[0].requiredPermissions.update' });
    expect(findings[0].message).toContain('mange_invoices');
  });

  it('warns on field, action, and app references', () => {
    const findings = validateCapabilityReferences({
      objects: [{
        name: 'hr_employee',
        fields: { salary: { type: 'currency', requiredPermissions: ['view_salaryy'] } },
        actions: [{ name: 'promote', requiredPermissions: ['approve_promo'] }],
      }],
      apps: [{
        name: 'hr',
        requiredPermissions: ['hr_admin'],
        navigation: [{ type: 'object', objectName: 'hr_employee', requiredPermissions: ['hr_nav_cap'] }],
      }],
      actions: [{ name: 'run_payroll', requiredPermissions: ['run_payroll_cap'] }],
    });
    const paths = findings.map((f) => f.path).sort();
    expect(paths).toEqual([
      'actions[0].requiredPermissions',
      'apps[0].navigation[0].requiredPermissions',
      'apps[0].requiredPermissions',
      'objects[0].actions[0].requiredPermissions',
      'objects[0].fields.salary.requiredPermissions',
    ]);
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
  });

  it('does NOT flag systemPermissions itself (the declaration side)', () => {
    // A package introduces a new capability by GRANTING it — never a warning.
    const findings = validateCapabilityReferences({
      permissions: [{ name: 'p', systemPermissions: ['brand_new_capability'] }],
    });
    expect(findings).toEqual([]);
  });

  it('tolerates junk / empty input', () => {
    expect(validateCapabilityReferences({})).toEqual([]);
    expect(validateCapabilityReferences(undefined as unknown as Record<string, unknown>)).toEqual([]);
    expect(validateCapabilityReferences({ objects: [null, 42, { name: 'x' }] as unknown })).toEqual([]);
  });
});

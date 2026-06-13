// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 Phase 1 — install-time namespace gate.
 *
 * A package's `manifest.namespace` is the mandatory object-name prefix and the
 * container that scopes its UI metadata, so it must be unique per installation.
 * `installPackage` refuses a package whose namespace is already owned by a
 * *different* installed package. Same-package reinstall and shareable platform
 * namespaces (`base`/`system`/`sys`) pass through; `OS_METADATA_COLLISION=warn`
 * downgrades the refusal to a warning.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry, NamespaceConflictError } from './registry';

const manifest = (id: string, namespace: string) => ({
  id,
  name: id,
  namespace,
  version: '1.0.0',
});

describe('SchemaRegistry — namespace install gate (ADR-0048 Phase 1)', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry({ multiTenant: false, collisionPolicy: 'error' });
    registry.logLevel = 'silent';
  });

  it('refuses a package whose namespace is already owned by a different package', () => {
    registry.installPackage(manifest('com.acme.crm', 'crm') as any);
    expect(() =>
      registry.installPackage(manifest('com.beta.crm', 'crm') as any),
    ).toThrowError(NamespaceConflictError);
  });

  it('error names both packages and the namespace', () => {
    registry.installPackage(manifest('com.acme.crm', 'crm') as any);
    try {
      registry.installPackage(manifest('com.beta.crm', 'crm') as any);
      throw new Error('expected a namespace conflict error');
    } catch (e) {
      expect(e).toBeInstanceOf(NamespaceConflictError);
      const err = e as NamespaceConflictError;
      expect(err.namespace).toBe('crm');
      expect(err.existingPackageId).toBe('com.acme.crm');
      expect(err.incomingPackageId).toBe('com.beta.crm');
      expect(err.message).toContain('com.acme.crm');
      expect(err.message).toContain('com.beta.crm');
      expect(err.message).toContain('crm');
    }
    // The conflicting package must NOT have been recorded.
    expect(registry.getPackage('com.beta.crm')).toBeUndefined();
    expect(registry.getNamespaceOwners('crm')).toEqual(['com.acme.crm']);
  });

  it('allows the same package to reinstall/reload its own namespace', () => {
    registry.installPackage(manifest('com.acme.crm', 'crm') as any);
    expect(() =>
      registry.installPackage(manifest('com.acme.crm', 'crm') as any),
    ).not.toThrow();
  });

  it('allows two packages with distinct namespaces', () => {
    registry.installPackage(manifest('com.acme.crm', 'crm') as any);
    expect(() =>
      registry.installPackage(manifest('com.acme.hr', 'hr') as any),
    ).not.toThrow();
  });

  it('exempts shareable platform namespaces (base/system/sys)', () => {
    for (const ns of ['base', 'system', 'sys']) {
      registry.installPackage(manifest(`com.a.${ns}`, ns) as any);
      expect(() =>
        registry.installPackage(manifest(`com.b.${ns}`, ns) as any),
      ).not.toThrow();
    }
  });

  it('downgrades to a warning under collisionPolicy "warn"', () => {
    const warnReg = new SchemaRegistry({ multiTenant: false, collisionPolicy: 'warn' });
    warnReg.logLevel = 'silent';
    warnReg.installPackage(manifest('com.acme.crm', 'crm') as any);
    expect(() =>
      warnReg.installPackage(manifest('com.beta.crm', 'crm') as any),
    ).not.toThrow();
    // Both packages are recorded; the namespace now has two owners.
    expect(warnReg.getNamespaceOwners('crm').sort()).toEqual(['com.acme.crm', 'com.beta.crm']);
  });

  it('releases the namespace on uninstall, allowing a different package to claim it', () => {
    registry.installPackage(manifest('com.acme.crm', 'crm') as any);
    registry.uninstallPackage('com.acme.crm');
    expect(() =>
      registry.installPackage(manifest('com.beta.crm', 'crm') as any),
    ).not.toThrow();
    expect(registry.getNamespaceOwners('crm')).toEqual(['com.beta.crm']);
  });
});

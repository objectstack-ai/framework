// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './registry';

/**
 * ADR-0029 K0 — single-owner-per-object invariant.
 *
 * The kernel `sys` namespace is shared across many first-party plugins
 * (plugin-auth, plugin-audit, plugin-webhooks, ...), but every object name
 * must resolve to exactly one owner. `registerObject` rejects a second
 * cross-package owner eagerly; `assertSingleOwnerPerObject` is the
 * install-time backstop that additionally catches "extend with no owner".
 */
describe('SchemaRegistry single-owner-per-object (ADR-0029 K0)', () => {
  let registry: SchemaRegistry;
  beforeEach(() => {
    registry = new SchemaRegistry({ multiTenant: false });
  });

  it('passes when each object has exactly one owner across packages sharing `sys`', () => {
    registry.registerObject(
      { name: 'sys_webhook', fields: {} } as any,
      'com.objectstack.plugin-webhook-outbox.schema',
      'sys',
      'own',
    );
    registry.registerObject(
      { name: 'sys_user', fields: {} } as any,
      'com.objectstack.plugin-auth',
      'sys',
      'own',
    );
    expect(() => registry.assertSingleOwnerPerObject()).not.toThrow();
  });

  it('passes when an owned object also has extenders from other packages', () => {
    registry.registerObject(
      { name: 'sys_user', fields: { a: { type: 'text' } } } as any,
      'com.objectstack.plugin-auth',
      'sys',
      'own',
    );
    registry.registerObject(
      { name: 'sys_user', fields: { b: { type: 'text' } } } as any,
      'com.acme.app',
      undefined,
      'extend',
      200,
    );
    expect(() => registry.assertSingleOwnerPerObject()).not.toThrow();
  });

  it('throws when an object has only extend contributions and no owner', () => {
    // registerObject permits extending a not-yet-owned object; the backstop
    // must surface it rather than letting it resolve to nothing.
    registry.registerObject(
      { name: 'sys_audit_log', fields: { note: { type: 'text' } } } as any,
      'com.acme.app',
      undefined,
      'extend',
      200,
    );
    expect(() => registry.assertSingleOwnerPerObject()).toThrowError(/no owner/);
    expect(() => registry.assertSingleOwnerPerObject()).toThrowError(/sys_audit_log/);
  });

  it('rejects a second cross-package owner at registration time', () => {
    registry.registerObject(
      { name: 'sys_job', fields: {} } as any,
      'com.objectstack.service-job',
      'sys',
      'own',
    );
    expect(() =>
      registry.registerObject(
        { name: 'sys_job', fields: {} } as any,
        'com.evil.app',
        'sys',
        'own',
      ),
    ).toThrowError(/already owned/);
    // The registry remains single-owner after the rejected attempt.
    expect(() => registry.assertSingleOwnerPerObject()).not.toThrow();
  });
});

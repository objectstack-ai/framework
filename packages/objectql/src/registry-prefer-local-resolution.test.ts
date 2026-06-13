// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 Phase 2 — prefer-local (container-scoped) resolution.
 *
 * With the install-time namespace gate (Phase 1) keeping namespaces distinct,
 * two packages may legitimately ship the same bare name (e.g. `page/home`).
 * They no longer collide at registration; instead `getItem(type, name, ns)`
 * routes each caller to the item owned by its own namespace's package. The
 * per-item collision guard now fires only where prefer-local CANNOT
 * disambiguate (shared / missing namespace).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './registry';

const install = (reg: SchemaRegistry, id: string, namespace: string) =>
  reg.installPackage({ id, name: id, namespace, version: '1.0.0' } as any);

describe('SchemaRegistry — prefer-local resolution (ADR-0048 Phase 2)', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry({ multiTenant: false, collisionPolicy: 'error' });
    registry.logLevel = 'silent';
    install(registry, 'com.acme.crm', 'crm');
    install(registry, 'com.acme.hr', 'hr');
  });

  it('lets two distinct-namespace packages coexist on the same bare name', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    expect(() =>
      registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr'),
    ).not.toThrow();
  });

  it('resolves prefer-local to the namespace owner', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr');

    expect(registry.getItem<any>('page', 'home', 'crm')?.title).toBe('CRM Home');
    expect(registry.getItem<any>('page', 'home', 'hr')?.title).toBe('HR Home');
  });

  it('context-free getItem still returns one of the entries (legacy first-match fallback)', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr');

    const got = registry.getItem<any>('page', 'home');
    expect(['CRM Home', 'HR Home']).toContain(got?.title);
  });

  it('keeps runtime/DB overlay (bare key) precedence over prefer-local (ADR-0005)', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    // Runtime-authored overlay under the bare key (no package provenance).
    registry.registerItem('page', { name: 'home', title: 'overlay' }, 'name');

    expect(registry.getItem<any>('page', 'home', 'crm')?.title).toBe('overlay');
  });

  it('falls back to first-match when the namespace owns no such item', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    // hr has no `home`; asking within hr's container falls back to the only entry.
    expect(registry.getItem<any>('page', 'home', 'hr')?.title).toBe('CRM Home');
  });

  it('still fails loudly when two packages SHARE a namespace (unresolvable)', () => {
    const reg = new SchemaRegistry({ multiTenant: false, collisionPolicy: 'error' });
    reg.logLevel = 'silent';
    // `sys` is a shareable platform namespace, exempt from the install gate, so
    // two packages CAN both own it — but then a same-named item is ambiguous.
    install(reg, 'com.a.sys', 'sys');
    install(reg, 'com.b.sys', 'sys');
    reg.registerItem('flow', { name: 'cleanup' }, 'name', 'com.a.sys');
    expect(() =>
      reg.registerItem('flow', { name: 'cleanup' }, 'name', 'com.b.sys'),
    ).toThrow();
  });
});

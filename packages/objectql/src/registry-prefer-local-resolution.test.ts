// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 §3.3 — package-scoped (prefer-local) resolution.
 *
 * Two installed packages may ship the same bare name (e.g. `page/home`). They
 * coexist under distinct composite keys, and `getItem(type, name,
 * currentPackageId)` routes each caller to its own package's item. Because
 * package ids are globally unique, this is unambiguous and needs no install-time
 * gate to hold — it works for any caller carrying its package id.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './registry';

describe('SchemaRegistry — package-scoped resolution (ADR-0048 §3.3)', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry({ multiTenant: false });
    registry.logLevel = 'silent';
  });

  it('resolves prefer-local to the caller package', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr');

    expect(registry.getItem<any>('page', 'home', 'com.acme.crm')?.title).toBe('CRM Home');
    expect(registry.getItem<any>('page', 'home', 'com.acme.hr')?.title).toBe('HR Home');
  });

  it('context-free getItem still returns one of the entries (legacy first-match fallback)', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr');

    const got = registry.getItem<any>('page', 'home');
    expect(['CRM Home', 'HR Home']).toContain(got?.title);
  });

  it('keeps runtime/DB overlay (bare key) precedence over prefer-local (ADR-0005)', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    registry.registerItem('page', { name: 'home', title: 'overlay' }, 'name'); // bare, no package

    expect(registry.getItem<any>('page', 'home', 'com.acme.crm')?.title).toBe('overlay');
  });

  it('falls back to first-match when the caller package owns no such item', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    // com.acme.hr has no `home`; asking within its package falls back to the only entry.
    expect(registry.getItem<any>('page', 'home', 'com.acme.hr')?.title).toBe('CRM Home');
  });

  it('disambiguates even when two packages share a namespace (package id is the key)', () => {
    // `sys` is a shareable namespace, so two packages can both own it. Under
    // package-scoped resolution that is still unambiguous — the key is the
    // package id, not the namespace.
    registry.registerItem('flow', { name: 'cleanup', title: 'A' }, 'name', 'com.a.sys');
    registry.registerItem('flow', { name: 'cleanup', title: 'B' }, 'name', 'com.b.sys');

    expect(registry.getItem<any>('flow', 'cleanup', 'com.a.sys')?.title).toBe('A');
    expect(registry.getItem<any>('flow', 'cleanup', 'com.b.sys')?.title).toBe('B');
  });
});

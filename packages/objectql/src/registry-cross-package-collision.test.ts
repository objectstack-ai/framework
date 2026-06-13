// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 §3.4 — cross-package coexistence.
 *
 * Bare-named generic metadata (`page`, `dashboard`, `flow`, `action`, `doc`,
 * …) carries no package coordinate in the *logical* key, but the registry
 * stores each owner's item under a distinct composite key (`<pkg>:<name>`).
 * Because package ids are globally unique, package-scoped resolution
 * (`getItem(type, name, currentPackageId)`) routes each caller to its own
 * package's item — so two installed packages shipping the same bare name
 * legitimately COEXIST. The original per-item cross-package throw is retired;
 * these tests pin that coexistence and the unchanged not-a-collision cases
 * (runtime/DB overlay, sys_metadata sentinel, same-package reload).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './registry';

describe('SchemaRegistry — cross-package coexistence (ADR-0048 §3.4)', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry({ multiTenant: false });
    registry.logLevel = 'silent';
  });

  it('lets two different packages register the same (type, name) without error', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    expect(() =>
      registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr'),
    ).not.toThrow();
  });

  it('keeps both packages reachable via package-scoped resolution', () => {
    registry.registerItem('page', { name: 'home', title: 'CRM Home' }, 'name', 'com.acme.crm');
    registry.registerItem('page', { name: 'home', title: 'HR Home' }, 'name', 'com.acme.hr');
    expect(registry.getItem<any>('page', 'home', 'com.acme.crm')?.title).toBe('CRM Home');
    expect(registry.getItem<any>('page', 'home', 'com.acme.hr')?.title).toBe('HR Home');
  });

  it('does NOT error when the same package re-registers the same name (idempotent reload)', () => {
    registry.registerItem('page', { name: 'home', title: 'v1' }, 'name', 'com.acme.crm');
    expect(() =>
      registry.registerItem('page', { name: 'home', title: 'v2' }, 'name', 'com.acme.crm'),
    ).not.toThrow();
    // The latest value from the same package wins (overwrite under the same key).
    expect(registry.getItem<any>('page', 'home', 'com.acme.crm')?.title).toBe('v2');
  });

  it('keeps runtime/DB overlay (bare key) precedence over a packaged item (ADR-0005)', () => {
    registry.registerItem('page', { name: 'home', title: 'packaged' }, 'name', 'com.acme.crm');
    // A runtime-authored row (no packageId) overlays it under the bare key.
    expect(() =>
      registry.registerItem('page', { name: 'home', title: 'runtime' }, 'name'),
    ).not.toThrow();
    // Bare overlay wins even when a package id is supplied (documented precedence).
    expect(registry.getItem<any>('page', 'home', 'com.acme.crm')?.title).toBe('runtime');
  });

  it('does NOT error when a package ships over a pre-existing bare/runtime row', () => {
    registry.registerItem('page', { name: 'home', title: 'runtime' }, 'name');
    expect(() =>
      registry.registerItem('page', { name: 'home', title: 'packaged' }, 'name', 'com.acme.crm'),
    ).not.toThrow();
  });

  it('does NOT error for the sys_metadata rehydration sentinel', () => {
    registry.registerItem('page', { name: 'home', _packageId: 'sys_metadata' }, 'name');
    expect(() =>
      registry.registerItem('page', { name: 'home', title: 'packaged' }, 'name', 'com.acme.crm'),
    ).not.toThrow();
  });

  it('does NOT error for the same name across different types', () => {
    registry.registerItem('page', { name: 'home' }, 'name', 'com.acme.crm');
    expect(() =>
      registry.registerItem('dashboard', { name: 'home' }, 'name', 'com.acme.hr'),
    ).not.toThrow();
  });
});

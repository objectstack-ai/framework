// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 §3.4 — end-to-end: two packages shipping the same bare-named page
 * coexist through the real `ObjectQL.registerApp` entry point (the choke point
 * every installed package's metadata arrays flow through). Uses a real engine +
 * real registry (no mock) on purpose. Package-scoped resolution keeps each
 * package's `home` reachable; there is no cross-package throw.
 */

import { describe, it, expect } from 'vitest';
import { ObjectQL } from './engine';

describe('ObjectQL.registerApp — cross-package coexistence (ADR-0048 §3.4)', () => {
  it('lets a second package register a bare-named page already owned by another', () => {
    const engine = new ObjectQL();
    engine.registerApp({
      id: 'com.acme.crm',
      pages: [{ name: 'home', title: 'CRM Home' }],
    });

    expect(() =>
      engine.registerApp({
        id: 'com.acme.hr',
        pages: [{ name: 'home', title: 'HR Home' }],
      }),
    ).not.toThrow();
  });

  it('resolves each package\'s page by package id', () => {
    const engine = new ObjectQL();
    engine.registerApp({ id: 'com.acme.crm', pages: [{ name: 'home', title: 'CRM Home' }] });
    engine.registerApp({ id: 'com.acme.hr', pages: [{ name: 'home', title: 'HR Home' }] });

    expect(engine.registry.getItem<any>('page', 'home', 'com.acme.crm')?.title).toBe('CRM Home');
    expect(engine.registry.getItem<any>('page', 'home', 'com.acme.hr')?.title).toBe('HR Home');
  });

  it('allows two packages with differently-named pages (trivially)', () => {
    const engine = new ObjectQL();
    expect(() => {
      engine.registerApp({ id: 'com.acme.crm', pages: [{ name: 'crm_home', title: 'CRM Home' }] });
      engine.registerApp({ id: 'com.acme.hr', pages: [{ name: 'hr_home', title: 'HR Home' }] });
    }).not.toThrow();
  });

  it('allows the same package to be re-registered (idempotent reload)', () => {
    const engine = new ObjectQL();
    engine.registerApp({ id: 'com.acme.crm', pages: [{ name: 'home', title: 'v1' }] });
    expect(() =>
      engine.registerApp({ id: 'com.acme.crm', pages: [{ name: 'home', title: 'v2' }] }),
    ).not.toThrow();
  });
});

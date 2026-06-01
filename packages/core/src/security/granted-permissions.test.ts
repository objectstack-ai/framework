// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import {
  PluginPermissionEnforcer,
  SecurePluginContext,
  buildPermissionsFromGrants,
} from './plugin-permission-enforcer.js';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as any;

describe('buildPermissionsFromGrants (ADR-0025 F4)', () => {
  it('matches services by exact value, glob, and wildcard', () => {
    const p = buildPermissionsFromGrants({ services: ['object', 'http.*'] });
    expect(p.canAccessService('object')).toBe(true);
    expect(p.canAccessService('http.client')).toBe(true);
    expect(p.canAccessService('storage')).toBe(false);

    const all = buildPermissionsFromGrants({ services: ['*'] });
    expect(all.canAccessService('anything')).toBe(true);
  });

  it('matches hooks and treats fs as both read and write', () => {
    const p = buildPermissionsFromGrants({
      hooks: ['record.beforeInsert'],
      fs: ['/data/**'],
    });
    expect(p.canTriggerHook('record.beforeInsert')).toBe(true);
    expect(p.canTriggerHook('record.afterDelete')).toBe(false);
    expect(p.canReadFile('/data/a/b.txt')).toBe(true);
    expect(p.canWriteFile('/data/a/b.txt')).toBe(true);
    expect(p.canReadFile('/etc/passwd')).toBe(false);
  });

  it('matches network grants against the request URL host', () => {
    const p = buildPermissionsFromGrants({ network: ['api.acme.com'] });
    expect(p.canNetworkRequest('https://api.acme.com/v1/orders')).toBe(true);
    expect(p.canNetworkRequest('https://evil.example/steal')).toBe(false);
  });

  it('denies everything for a null / empty grant set (least privilege)', () => {
    for (const g of [null, undefined, {}]) {
      const p = buildPermissionsFromGrants(g as any);
      expect(p.canAccessService('object')).toBe(false);
      expect(p.canTriggerHook('x')).toBe(false);
      expect(p.canReadFile('/a')).toBe(false);
      expect(p.canWriteFile('/a')).toBe(false);
      expect(p.canNetworkRequest('https://a.b')).toBe(false);
    }
  });
});

describe('PluginPermissionEnforcer.registerGrantedPermissions', () => {
  it('enforces the granted surface and denies the rest', () => {
    const enforcer = new PluginPermissionEnforcer(logger);
    enforcer.registerGrantedPermissions('com.acme.p', { services: ['object'], hooks: [] });

    expect(() => enforcer.enforceServiceAccess('com.acme.p', 'object')).not.toThrow();
    expect(() => enforcer.enforceServiceAccess('com.acme.p', 'storage')).toThrow(/cannot access service storage/);
    expect(() => enforcer.enforceHookTrigger('com.acme.p', 'record.beforeInsert')).toThrow();
  });

  it('SecurePluginContext gates getService against the grant set', () => {
    const enforcer = new PluginPermissionEnforcer(logger);
    enforcer.registerGrantedPermissions('com.acme.p', { services: ['object'] });

    const base = {
      getService: vi.fn((name: string) => `svc:${name}`),
      registerService: vi.fn(),
      replaceService: vi.fn(),
      getServices: vi.fn(),
      hook: vi.fn(),
      trigger: vi.fn(),
      logger,
      getKernel: vi.fn(),
      registerServiceFactory: vi.fn(),
      getServiceScoped: vi.fn(),
    } as any;

    const secure = new SecurePluginContext('com.acme.p', enforcer, base);
    expect(secure.getService('object')).toBe('svc:object');
    expect(() => secure.getService('storage')).toThrow(/cannot access service storage/);
  });
});

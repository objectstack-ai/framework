// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type { ITenantRouter, ResolvedTenantContext } from './tenant-router';

describe('Tenant Router Contract', () => {
  it('should allow a minimal ITenantRouter implementation with all required methods', () => {
    const router: ITenantRouter = {
      resolveTenant: async () => null,
      getTenantClient: async () => ({}),
      invalidateCache: () => {},
    };

    expect(typeof router.resolveTenant).toBe('function');
    expect(typeof router.getTenantClient).toBe('function');
    expect(typeof router.invalidateCache).toBe('function');
  });

  it('should resolve a tenant context from a session', async () => {
    const tenants = new Map<string, ResolvedTenantContext>([
      ['session_abc', {
        tenantId: 'tenant_001',
        plan: 'pro',
        region: 'us-east',
        dbUrl: 'libsql://tenant-001.turso.io',
        status: 'active',
      }],
    ]);

    const router: ITenantRouter = {
      resolveTenant: async (session) => {
        const s = session as { sessionId: string };
        return tenants.get(s.sessionId) ?? null;
      },
      getTenantClient: async () => ({}),
      invalidateCache: () => {},
    };

    const ctx = await router.resolveTenant({ sessionId: 'session_abc' });
    expect(ctx).not.toBeNull();
    expect(ctx!.tenantId).toBe('tenant_001');
    expect(ctx!.plan).toBe('pro');
    expect(ctx!.region).toBe('us-east');
    expect(ctx!.status).toBe('active');
  });

  it('should return null for unknown sessions', async () => {
    const router: ITenantRouter = {
      resolveTenant: async () => null,
      getTenantClient: async () => ({}),
      invalidateCache: () => {},
    };

    const ctx = await router.resolveTenant({ sessionId: 'unknown' });
    expect(ctx).toBeNull();
  });

  it('should get a tenant client by tenantId', async () => {
    const router: ITenantRouter = {
      resolveTenant: async () => null,
      getTenantClient: async (tenantId) => ({ tenantId, connected: true }),
      invalidateCache: () => {},
    };

    const client = await router.getTenantClient('tenant_001') as any;
    expect(client.tenantId).toBe('tenant_001');
    expect(client.connected).toBe(true);
  });

  it('should invalidate cache for a tenant', () => {
    const cache = new Set<string>(['tenant_001', 'tenant_002']);

    const router: ITenantRouter = {
      resolveTenant: async () => null,
      getTenantClient: async () => ({}),
      invalidateCache: (tenantId) => {
        cache.delete(tenantId);
      },
    };

    router.invalidateCache('tenant_001');
    expect(cache.has('tenant_001')).toBe(false);
    expect(cache.has('tenant_002')).toBe(true);
  });
});

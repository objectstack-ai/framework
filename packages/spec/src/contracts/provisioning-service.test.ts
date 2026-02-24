// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type { IProvisioningService } from './provisioning-service';
import type { TenantProvisioningResult, TenantProvisioningStatus } from '../system/provisioning.zod';

describe('Provisioning Service Contract', () => {
  it('should allow a minimal IProvisioningService implementation with all required methods', () => {
    const service: IProvisioningService = {
      provisionTenant: async () => ({
        tenantId: 'tenant_001',
        connectionUrl: 'libsql://tenant-001.turso.io',
        status: 'active',
        region: 'us-east',
        plan: 'free',
        steps: [],
      }),
      suspendTenant: async () => {},
      resumeTenant: async () => {},
      destroyTenant: async () => {},
      getTenantStatus: async () => 'active',
      migrateTenantPlan: async () => {},
    };

    expect(typeof service.provisionTenant).toBe('function');
    expect(typeof service.suspendTenant).toBe('function');
    expect(typeof service.resumeTenant).toBe('function');
    expect(typeof service.destroyTenant).toBe('function');
    expect(typeof service.getTenantStatus).toBe('function');
    expect(typeof service.migrateTenantPlan).toBe('function');
  });

  it('should provision a new tenant', async () => {
    const tenants = new Map<string, TenantProvisioningResult>();
    let counter = 0;

    const service: IProvisioningService = {
      provisionTenant: async (request) => {
        const tenantId = `tenant_${++counter}`;
        const result: TenantProvisioningResult = {
          tenantId,
          connectionUrl: `libsql://${tenantId}.turso.io`,
          status: 'active',
          region: request.region ?? 'us-east',
          plan: request.plan ?? 'free',
          steps: [
            { name: 'create_database', status: 'completed', durationMs: 500 },
            { name: 'sync_schema', status: 'completed', durationMs: 800 },
            { name: 'seed_data', status: 'completed', durationMs: 200 },
          ],
          totalDurationMs: 1500,
          provisionedAt: new Date().toISOString(),
        };
        tenants.set(tenantId, result);
        return result;
      },
      suspendTenant: async () => {},
      resumeTenant: async () => {},
      destroyTenant: async () => {},
      getTenantStatus: async (tenantId) => {
        const t = tenants.get(tenantId);
        return t?.status ?? 'failed';
      },
      migrateTenantPlan: async () => {},
    };

    const result = await service.provisionTenant({
      orgId: 'org_abc',
      plan: 'pro',
      region: 'eu-west',
    });

    expect(result.tenantId).toBe('tenant_1');
    expect(result.status).toBe('active');
    expect(result.plan).toBe('pro');
    expect(result.region).toBe('eu-west');
    expect(result.steps).toHaveLength(3);
    expect(result.totalDurationMs).toBe(1500);

    const status = await service.getTenantStatus('tenant_1');
    expect(status).toBe('active');
  });

  it('should manage tenant lifecycle (suspend/resume/destroy)', async () => {
    const statuses = new Map<string, TenantProvisioningStatus>([
      ['tenant_001', 'active'],
    ]);

    const service: IProvisioningService = {
      provisionTenant: async () => ({
        tenantId: 'tenant_001',
        connectionUrl: 'libsql://tenant-001.turso.io',
        status: 'active',
        region: 'us-east',
        plan: 'free',
        steps: [],
      }),
      suspendTenant: async (tenantId) => {
        statuses.set(tenantId, 'suspended');
      },
      resumeTenant: async (tenantId) => {
        statuses.set(tenantId, 'active');
      },
      destroyTenant: async (tenantId) => {
        statuses.set(tenantId, 'destroying');
      },
      getTenantStatus: async (tenantId) => statuses.get(tenantId) ?? 'failed',
      migrateTenantPlan: async () => {},
    };

    expect(await service.getTenantStatus('tenant_001')).toBe('active');

    await service.suspendTenant('tenant_001');
    expect(await service.getTenantStatus('tenant_001')).toBe('suspended');

    await service.resumeTenant('tenant_001');
    expect(await service.getTenantStatus('tenant_001')).toBe('active');

    await service.destroyTenant('tenant_001');
    expect(await service.getTenantStatus('tenant_001')).toBe('destroying');
  });

  it('should migrate a tenant plan', async () => {
    let currentPlan = 'free';

    const service: IProvisioningService = {
      provisionTenant: async () => ({
        tenantId: 'tenant_001',
        connectionUrl: 'libsql://tenant-001.turso.io',
        status: 'active',
        region: 'us-east',
        plan: currentPlan as any,
        steps: [],
      }),
      suspendTenant: async () => {},
      resumeTenant: async () => {},
      destroyTenant: async () => {},
      getTenantStatus: async () => 'active',
      migrateTenantPlan: async (_tenantId, newPlan) => {
        currentPlan = newPlan;
      },
    };

    await service.migrateTenantPlan('tenant_001', 'enterprise');
    expect(currentPlan).toBe('enterprise');
  });
});

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { TenantProvisioningService } from './tenant-provisioning';
import type { ProvisionTenantRequest } from '@objectstack/spec/cloud';

describe('TenantProvisioningService - Multi-Driver Support', () => {
  it('should provision tenant with Turso driver', async () => {
    const service = new TenantProvisioningService({
      defaultStorageLimitMb: 1024,
    });

    const request: ProvisionTenantRequest = {
      organizationId: 'org-turso-001',
      driverConfig: {
        driver: 'turso',
        databaseUrl: 'libsql://test.turso.io',
        authToken: 'test-token',
        region: 'us-east-1',
      },
      plan: 'pro',
    };

    const result = await service.provisionTenant(request);

    expect(result.tenant).toBeDefined();
    expect(result.tenant.driverConfig.driver).toBe('turso');
    expect(result.tenant.organizationId).toBe('org-turso-001');
    expect(result.tenant.status).toBe('active');
  });

  it('should provision tenant with Memory driver', async () => {
    const service = new TenantProvisioningService({
      defaultStorageLimitMb: 512,
    });

    const request: ProvisionTenantRequest = {
      organizationId: 'org-memory-001',
      driverConfig: {
        driver: 'memory',
        persistent: false,
      },
      plan: 'free',
    };

    const result = await service.provisionTenant(request);

    expect(result.tenant).toBeDefined();
    expect(result.tenant.driverConfig.driver).toBe('memory');
    expect(result.tenant.storageLimitMb).toBe(512);
    expect(result.warnings).toContain('Memory driver: Data will be lost on restart unless persistence is enabled');
  });

  it('should provision tenant with SQL driver', async () => {
    const service = new TenantProvisioningService();

    const request: ProvisionTenantRequest = {
      organizationId: 'org-sql-001',
      driverConfig: {
        driver: 'sql',
        dialect: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'tenant_db',
        username: 'postgres',
        password: 'secret',
        ssl: true,
      },
      plan: 'enterprise',
    };

    const result = await service.provisionTenant(request);

    expect(result.tenant).toBeDefined();
    expect(result.tenant.driverConfig.driver).toBe('sql');
    if (result.tenant.driverConfig.driver === 'sql') {
      expect(result.tenant.driverConfig.dialect).toBe('postgresql');
      expect(result.tenant.driverConfig.host).toBe('localhost');
    }
    expect(result.tenant.plan).toBe('enterprise');
  });

  it('should provision tenant with SQLite driver', async () => {
    const service = new TenantProvisioningService();

    const request: ProvisionTenantRequest = {
      organizationId: 'org-sqlite-001',
      driverConfig: {
        driver: 'sqlite',
        filename: '/data/tenant-001.db',
      },
      plan: 'free',
    };

    const result = await service.provisionTenant(request);

    expect(result.tenant).toBeDefined();
    expect(result.tenant.driverConfig.driver).toBe('sqlite');
    if (result.tenant.driverConfig.driver === 'sqlite') {
      expect(result.tenant.driverConfig.filename).toBe('/data/tenant-001.db');
    }
  });

  it('should provision tenant with Custom driver', async () => {
    const service = new TenantProvisioningService();

    const request: ProvisionTenantRequest = {
      organizationId: 'org-custom-001',
      driverConfig: {
        driver: 'custom',
        driverName: 'my-custom-driver',
        config: {
          endpoint: 'https://api.example.com',
          apiKey: 'secret',
        },
      },
      plan: 'custom',
    };

    const result = await service.provisionTenant(request);

    expect(result.tenant).toBeDefined();
    expect(result.tenant.driverConfig.driver).toBe('custom');
    if (result.tenant.driverConfig.driver === 'custom') {
      expect(result.tenant.driverConfig.driverName).toBe('my-custom-driver');
      expect(result.tenant.driverConfig.config).toEqual({
        endpoint: 'https://api.example.com',
        apiKey: 'secret',
      });
    }
    expect(result.warnings).toContain('Using custom driver: my-custom-driver');
  });

  it('should include provisioning duration in response', async () => {
    const service = new TenantProvisioningService();

    const request: ProvisionTenantRequest = {
      organizationId: 'org-test',
      driverConfig: {
        driver: 'memory',
        persistent: false,
      },
    };

    const result = await service.provisionTenant(request);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

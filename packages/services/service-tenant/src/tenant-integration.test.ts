// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantProvisioningService } from '../src/tenant-provisioning';
import { TenantSchemaInitializer } from '../src/tenant-schema-initializer';
import type { ProvisionTenantRequest } from '@objectstack/spec/cloud';

describe('TenantProvisioningService', () => {
  describe('provisionTenant', () => {
    it('should provision tenant in mock mode', async () => {
      const service = new TenantProvisioningService({
        defaultRegion: 'us-west-2',
        defaultStorageLimitMb: 2048,
      });

      const request: ProvisionTenantRequest = {
        organizationId: 'org-123',
        plan: 'pro',
      };

      const response = await service.provisionTenant(request);

      expect(response.tenant).toBeDefined();
      expect(response.tenant.organizationId).toBe('org-123');
      expect(response.tenant.plan).toBe('pro');
      expect(response.tenant.region).toBe('us-west-2');
      expect(response.tenant.storageLimitMb).toBe(2048);
      expect(response.tenant.status).toBe('active');
      expect(response.tenant.databaseName).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ); // UUID format
      expect(response.tenant.databaseUrl).toContain('libsql://');
      expect(response.durationMs).toBeGreaterThanOrEqual(0);
      expect(response.warnings).toBeDefined();
      expect(response.warnings).toContain(
        'Running in mock mode - Turso Platform API credentials not configured',
      );
    });

    it('should use custom region and storage limit', async () => {
      const service = new TenantProvisioningService();

      const request: ProvisionTenantRequest = {
        organizationId: 'org-456',
        region: 'eu-central-1',
        storageLimitMb: 5120,
      };

      const response = await service.provisionTenant(request);

      expect(response.tenant.region).toBe('eu-central-1');
      expect(response.tenant.storageLimitMb).toBe(5120);
    });

    it('should generate UUID-based database names', async () => {
      const service = new TenantProvisioningService();

      const request: ProvisionTenantRequest = {
        organizationId: 'org-789',
      };

      const response1 = await service.provisionTenant(request);
      const response2 = await service.provisionTenant(request);

      // Each tenant should have unique UUID
      expect(response1.tenant.id).not.toBe(response2.tenant.id);
      expect(response1.tenant.databaseName).not.toBe(response2.tenant.databaseName);

      // Database name should match tenant ID (UUID-based)
      expect(response1.tenant.databaseName).toBe(response1.tenant.id);
      expect(response2.tenant.databaseName).toBe(response2.tenant.id);
    });
  });

  describe('lifecycle operations', () => {
    it('should suspend tenant with control plane driver', async () => {
      const mockDriver = {
        update: vi.fn().mockResolvedValue(undefined),
      };

      const service = new TenantProvisioningService({
        controlPlaneDriver: mockDriver as any,
      });

      await service.suspendTenant('tenant-123');

      expect(mockDriver.update).toHaveBeenCalledWith('tenant_database', 'tenant-123', {
        status: 'suspended',
        updated_at: expect.any(String),
      });
    });

    it('should archive tenant and optionally delete from platform', async () => {
      const mockDriver = {
        findById: vi.fn().mockResolvedValue({
          id: 'tenant-123',
          database_name: 'db-name',
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };

      const service = new TenantProvisioningService({
        controlPlaneDriver: mockDriver as any,
      });

      await service.archiveTenant('tenant-123');

      expect(mockDriver.findById).toHaveBeenCalledWith('tenant_database', 'tenant-123');
      expect(mockDriver.update).toHaveBeenCalledWith('tenant_database', 'tenant-123', {
        status: 'archived',
        updated_at: expect.any(String),
      });
    });

    it('should restore suspended tenant', async () => {
      const mockDriver = {
        findById: vi.fn().mockResolvedValue({
          id: 'tenant-123',
          status: 'suspended',
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };

      const service = new TenantProvisioningService({
        controlPlaneDriver: mockDriver as any,
      });

      await service.restoreTenant('tenant-123');

      expect(mockDriver.update).toHaveBeenCalledWith('tenant_database', 'tenant-123', {
        status: 'active',
        updated_at: expect.any(String),
      });
    });

    it('should not restore archived tenant', async () => {
      const mockDriver = {
        findById: vi.fn().mockResolvedValue({
          id: 'tenant-123',
          status: 'archived',
        }),
      };

      const service = new TenantProvisioningService({
        controlPlaneDriver: mockDriver as any,
      });

      await expect(service.restoreTenant('tenant-123')).rejects.toThrow(
        'Cannot restore archived tenant',
      );
    });
  });
});

describe('TenantSchemaInitializer', () => {
  it('should create instance', () => {
    const initializer = new TenantSchemaInitializer();
    expect(initializer).toBeDefined();
  });

  // Note: Full integration tests would require actual Turso database
  // These are placeholders for future implementation
  it.skip('should initialize tenant schema with base tables', async () => {
    const initializer = new TenantSchemaInitializer();
    // TODO: Implement with test database
  });

  it.skip('should install package schema', async () => {
    const initializer = new TenantSchemaInitializer();
    // TODO: Implement with test database
  });
});

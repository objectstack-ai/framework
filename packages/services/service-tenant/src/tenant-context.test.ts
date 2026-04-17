// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContextService } from '../src/tenant-context';
import type { TenantRoutingConfig } from '@objectstack/spec/cloud';

describe('TenantContextService', () => {
  let service: TenantContextService;

  beforeEach(() => {
    const config: TenantRoutingConfig = {
      enabled: true,
      identificationSources: ['header', 'custom_domain'],
      tenantHeaderName: 'X-Tenant-ID',
      customDomainMapping: {
        'app.acme.com': '550e8400-e29b-41d4-a716-446655440000',
      },
    };
    service = new TenantContextService(config);
  });

  describe('resolveTenantContext', () => {
    it('should extract tenant from header', async () => {
      const context = await service.resolveTenantContext({
        headers: {
          'X-Tenant-ID': '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(context).toBeDefined();
      expect(context?.tenantId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(context?.databaseUrl).toBe('libsql://550e8400-e29b-41d4-a716-446655440000.turso.io');
    });

    it('should extract tenant from custom domain', async () => {
      const context = await service.resolveTenantContext({
        hostname: 'app.acme.com',
      });

      expect(context).toBeDefined();
      expect(context?.tenantId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return null when multi-tenant is disabled', async () => {
      const disabledConfig: TenantRoutingConfig = {
        enabled: false,
        identificationSources: [],
      };
      const disabledService = new TenantContextService(disabledConfig);

      const context = await disabledService.resolveTenantContext({
        headers: { 'X-Tenant-ID': '123' },
      });

      expect(context).toBeNull();
    });

    it('should cache tenant contexts', async () => {
      const context1 = await service.resolveTenantContext({
        headers: { 'X-Tenant-ID': 'tenant-123' },
      });

      const context2 = await service.resolveTenantContext({
        headers: { 'X-Tenant-ID': 'tenant-123' },
      });

      expect(context1).toBe(context2); // Same object reference from cache
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await service.resolveTenantContext({
        headers: { 'X-Tenant-ID': 'tenant-123' },
      });

      service.clearCache();

      // After clearing cache, should create new context
      const context = await service.resolveTenantContext({
        headers: { 'X-Tenant-ID': 'tenant-123' },
      });

      expect(context).toBeDefined();
    });

    it('should invalidate specific tenant', async () => {
      await service.resolveTenantContext({
        headers: { 'X-Tenant-ID': 'tenant-123' },
      });

      service.invalidateTenant('tenant-123');

      // Should still work after invalidation
      const context = await service.resolveTenantContext({
        headers: { 'X-Tenant-ID': 'tenant-123' },
      });

      expect(context).toBeDefined();
    });
  });
});

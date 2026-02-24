import { describe, it, expect } from 'vitest';
import {
  TursoMultiTenantConfigSchema,
  TenantResolverStrategySchema,
  TursoGroupSchema,
  TenantDatabaseLifecycleSchema,
  type TursoMultiTenantConfig,
  type TenantResolverStrategy,
  type TursoGroup,
  type TenantDatabaseLifecycle,
} from './turso-multi-tenant.zod';

describe('TenantResolverStrategySchema', () => {
  it('should accept valid resolver strategies', () => {
    const strategies: TenantResolverStrategy[] = ['header', 'subdomain', 'path', 'token', 'lookup'];
    strategies.forEach((s) => {
      expect(() => TenantResolverStrategySchema.parse(s)).not.toThrow();
    });
  });

  it('should reject invalid resolver strategy', () => {
    expect(() => TenantResolverStrategySchema.parse('cookie')).toThrow();
  });
});

describe('TursoGroupSchema', () => {
  it('should accept valid group config', () => {
    const group: TursoGroup = {
      name: 'production',
      primaryLocation: 'iad',
      replicaLocations: ['lhr', 'nrt'],
      schemaDatabase: 'schema-db',
    };
    const parsed = TursoGroupSchema.parse(group);
    expect(parsed.name).toBe('production');
    expect(parsed.primaryLocation).toBe('iad');
    expect(parsed.replicaLocations).toEqual(['lhr', 'nrt']);
    expect(parsed.schemaDatabase).toBe('schema-db');
  });

  it('should accept minimal group config', () => {
    const group = { name: 'default', primaryLocation: 'iad' };
    const parsed = TursoGroupSchema.parse(group);
    expect(parsed.replicaLocations).toEqual([]);
    expect(parsed.schemaDatabase).toBeUndefined();
  });

  it('should reject empty group name', () => {
    expect(() => TursoGroupSchema.parse({ name: '', primaryLocation: 'iad' })).toThrow();
  });

  it('should reject short primary location', () => {
    expect(() => TursoGroupSchema.parse({ name: 'test', primaryLocation: 'x' })).toThrow();
  });
});

describe('TenantDatabaseLifecycleSchema', () => {
  it('should accept full lifecycle config', () => {
    const lifecycle: TenantDatabaseLifecycle = {
      onTenantCreate: {
        autoCreate: true,
        group: 'production',
        applyGroupSchema: true,
        seedData: true,
      },
      onTenantDelete: {
        immediate: false,
        gracePeriodHours: 168,
        createBackup: true,
      },
      onTenantSuspend: {
        revokeTokens: true,
        readOnly: true,
      },
    };
    const parsed = TenantDatabaseLifecycleSchema.parse(lifecycle);
    expect(parsed.onTenantCreate.autoCreate).toBe(true);
    expect(parsed.onTenantDelete.gracePeriodHours).toBe(168);
    expect(parsed.onTenantSuspend.revokeTokens).toBe(true);
  });

  it('should apply defaults for lifecycle hooks', () => {
    const lifecycle = {
      onTenantCreate: {},
      onTenantDelete: {},
      onTenantSuspend: {},
    };
    const parsed = TenantDatabaseLifecycleSchema.parse(lifecycle);
    expect(parsed.onTenantCreate.autoCreate).toBe(true);
    expect(parsed.onTenantCreate.applyGroupSchema).toBe(true);
    expect(parsed.onTenantCreate.seedData).toBe(false);
    expect(parsed.onTenantDelete.immediate).toBe(false);
    expect(parsed.onTenantDelete.gracePeriodHours).toBe(72);
    expect(parsed.onTenantDelete.createBackup).toBe(true);
    expect(parsed.onTenantSuspend.revokeTokens).toBe(true);
    expect(parsed.onTenantSuspend.readOnly).toBe(true);
  });
});

describe('TursoMultiTenantConfigSchema', () => {
  it('should accept full config', () => {
    const config: TursoMultiTenantConfig = {
      organizationSlug: 'myorg',
      urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
      groupAuthToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.test-token',
      tenantResolverStrategy: 'token',
      group: {
        name: 'production',
        primaryLocation: 'iad',
        replicaLocations: ['lhr'],
        schemaDatabase: 'schema-db',
      },
      lifecycle: {
        onTenantCreate: { autoCreate: true },
        onTenantDelete: { gracePeriodHours: 168 },
        onTenantSuspend: { revokeTokens: true },
      },
      maxCachedConnections: 200,
      connectionCacheTTL: 600,
    };
    const parsed = TursoMultiTenantConfigSchema.parse(config);
    expect(parsed.organizationSlug).toBe('myorg');
    expect(parsed.tenantResolverStrategy).toBe('token');
    expect(parsed.maxCachedConnections).toBe(200);
  });

  it('should accept minimal config with defaults', () => {
    const config = {
      organizationSlug: 'myorg',
      urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
      groupAuthToken: 'token123',
    };
    const parsed = TursoMultiTenantConfigSchema.parse(config);
    expect(parsed.tenantResolverStrategy).toBe('token');
    expect(parsed.maxCachedConnections).toBe(100);
    expect(parsed.connectionCacheTTL).toBe(300);
    expect(parsed.group).toBeUndefined();
    expect(parsed.lifecycle).toBeUndefined();
  });

  it('should reject missing organizationSlug', () => {
    expect(() => TursoMultiTenantConfigSchema.parse({
      urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
      groupAuthToken: 'token',
    })).toThrow();
  });

  it('should reject missing urlTemplate', () => {
    expect(() => TursoMultiTenantConfigSchema.parse({
      organizationSlug: 'myorg',
      groupAuthToken: 'token',
    })).toThrow();
  });

  it('should reject missing groupAuthToken', () => {
    expect(() => TursoMultiTenantConfigSchema.parse({
      organizationSlug: 'myorg',
      urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
    })).toThrow();
  });

  it('should accept all resolver strategies', () => {
    const strategies = ['header', 'subdomain', 'path', 'token', 'lookup'];
    strategies.forEach((strategy) => {
      const config = {
        organizationSlug: 'myorg',
        urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
        groupAuthToken: 'token',
        tenantResolverStrategy: strategy,
      };
      expect(() => TursoMultiTenantConfigSchema.parse(config)).not.toThrow();
    });
  });

  it('should reject invalid maxCachedConnections', () => {
    expect(() => TursoMultiTenantConfigSchema.parse({
      organizationSlug: 'myorg',
      urlTemplate: 'libsql://{tenant_id}-myorg.turso.io',
      groupAuthToken: 'token',
      maxCachedConnections: 0,
    })).toThrow();
  });
});

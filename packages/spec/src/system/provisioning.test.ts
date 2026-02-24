import { describe, it, expect } from 'vitest';
import {
  TenantProvisioningStatusEnum,
  TenantPlanSchema,
  TenantRegionSchema,
  ProvisioningStepSchema,
  TenantProvisioningRequestSchema,
  TenantProvisioningResultSchema,
  type TenantProvisioningStatus,
  type TenantPlan,
  type TenantRegion,
  type ProvisioningStep,
  type TenantProvisioningRequest,
  type TenantProvisioningResult,
} from './provisioning.zod';

describe('TenantProvisioningStatusEnum', () => {
  it('should accept valid statuses', () => {
    const statuses: TenantProvisioningStatus[] = ['provisioning', 'active', 'suspended', 'failed', 'destroying'];
    statuses.forEach((s) => {
      expect(() => TenantProvisioningStatusEnum.parse(s)).not.toThrow();
    });
  });

  it('should reject invalid status', () => {
    expect(() => TenantProvisioningStatusEnum.parse('pending')).toThrow();
  });
});

describe('TenantPlanSchema', () => {
  it('should accept valid plans', () => {
    const plans: TenantPlan[] = ['free', 'pro', 'enterprise'];
    plans.forEach((p) => {
      expect(() => TenantPlanSchema.parse(p)).not.toThrow();
    });
  });

  it('should reject invalid plan', () => {
    expect(() => TenantPlanSchema.parse('basic')).toThrow();
  });
});

describe('TenantRegionSchema', () => {
  it('should accept valid regions', () => {
    const regions: TenantRegion[] = ['us-east', 'us-west', 'eu-west', 'eu-central', 'ap-southeast', 'ap-northeast'];
    regions.forEach((r) => {
      expect(() => TenantRegionSchema.parse(r)).not.toThrow();
    });
  });

  it('should reject invalid region', () => {
    expect(() => TenantRegionSchema.parse('us-south')).toThrow();
  });
});

describe('ProvisioningStepSchema', () => {
  it('should accept a completed step', () => {
    const step: ProvisioningStep = {
      name: 'create_database',
      status: 'completed',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:02Z',
      durationMs: 2000,
    };
    const parsed = ProvisioningStepSchema.parse(step);
    expect(parsed.name).toBe('create_database');
    expect(parsed.status).toBe('completed');
  });

  it('should accept a pending step with minimal fields', () => {
    const step = { name: 'sync_schema', status: 'pending' };
    expect(() => ProvisioningStepSchema.parse(step)).not.toThrow();
  });

  it('should accept a failed step with error', () => {
    const step = {
      name: 'create_database',
      status: 'failed',
      error: 'Turso API rate limit exceeded',
    };
    expect(() => ProvisioningStepSchema.parse(step)).not.toThrow();
  });

  it('should accept all step statuses', () => {
    const statuses = ['pending', 'running', 'completed', 'failed', 'skipped'];
    statuses.forEach((status) => {
      expect(() => ProvisioningStepSchema.parse({ name: 'test', status })).not.toThrow();
    });
  });

  it('should reject empty step name', () => {
    expect(() => ProvisioningStepSchema.parse({ name: '', status: 'pending' })).toThrow();
  });
});

describe('TenantProvisioningRequestSchema', () => {
  it('should accept full request', () => {
    const request: TenantProvisioningRequest = {
      orgId: 'org_123',
      plan: 'pro',
      region: 'eu-west',
      displayName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      metadata: { industry: 'tech' },
    };
    const parsed = TenantProvisioningRequestSchema.parse(request);
    expect(parsed.orgId).toBe('org_123');
    expect(parsed.plan).toBe('pro');
    expect(parsed.region).toBe('eu-west');
  });

  it('should accept minimal request with defaults', () => {
    const request = { orgId: 'org_456' };
    const parsed = TenantProvisioningRequestSchema.parse(request);
    expect(parsed.plan).toBe('free');
    expect(parsed.region).toBe('us-east');
    expect(parsed.displayName).toBeUndefined();
  });

  it('should reject missing orgId', () => {
    expect(() => TenantProvisioningRequestSchema.parse({})).toThrow();
  });

  it('should reject invalid email', () => {
    expect(() => TenantProvisioningRequestSchema.parse({
      orgId: 'org_789',
      adminEmail: 'not-an-email',
    })).toThrow();
  });
});

describe('TenantProvisioningResultSchema', () => {
  it('should accept full result', () => {
    const result: TenantProvisioningResult = {
      tenantId: 'tenant_abc',
      connectionUrl: 'libsql://tenant-abc-myorg.turso.io',
      status: 'active',
      region: 'us-east',
      plan: 'free',
      steps: [
        { name: 'create_database', status: 'completed', durationMs: 1500 },
        { name: 'sync_schema', status: 'completed', durationMs: 800 },
      ],
      totalDurationMs: 2300,
      provisionedAt: '2026-01-01T00:00:03Z',
    };
    const parsed = TenantProvisioningResultSchema.parse(result);
    expect(parsed.tenantId).toBe('tenant_abc');
    expect(parsed.status).toBe('active');
    expect(parsed.steps).toHaveLength(2);
  });

  it('should accept failed result with error', () => {
    const result = {
      tenantId: 'tenant_fail',
      connectionUrl: 'libsql://failed.turso.io',
      status: 'failed',
      region: 'us-east',
      plan: 'free',
      error: 'Database creation timeout',
    };
    const parsed = TenantProvisioningResultSchema.parse(result);
    expect(parsed.status).toBe('failed');
    expect(parsed.error).toBe('Database creation timeout');
    expect(parsed.steps).toEqual([]);
  });

  it('should reject missing required fields', () => {
    expect(() => TenantProvisioningResultSchema.parse({
      tenantId: 'test',
    })).toThrow();
  });
});

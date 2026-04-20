// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  EnvironmentSchema,
  EnvironmentTypeSchema,
  EnvironmentStatusSchema,
  EnvironmentDatabaseSchema,
  DatabaseCredentialSchema,
  DatabaseCredentialStatusSchema,
  EnvironmentMemberSchema,
  EnvironmentRoleSchema,
  ProvisionEnvironmentRequestSchema,
  ProvisionOrganizationRequestSchema,
} from './environment.zod';

describe('EnvironmentTypeSchema', () => {
  it('accepts all canonical environment types', () => {
    for (const t of [
      'production',
      'sandbox',
      'development',
      'test',
      'staging',
      'preview',
      'trial',
    ]) {
      expect(() => EnvironmentTypeSchema.parse(t)).not.toThrow();
    }
  });

  it('rejects unknown types', () => {
    expect(() => EnvironmentTypeSchema.parse('prod')).toThrow();
  });
});

describe('EnvironmentStatusSchema', () => {
  it('accepts lifecycle statuses including migrating', () => {
    for (const s of [
      'provisioning',
      'active',
      'suspended',
      'archived',
      'failed',
      'migrating',
    ]) {
      expect(() => EnvironmentStatusSchema.parse(s)).not.toThrow();
    }
  });
});

describe('EnvironmentSchema', () => {
  const base = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organizationId: 'org_1',
    slug: 'prod',
    displayName: 'Production',
    envType: 'production' as const,
    isDefault: true,
    plan: 'pro' as const,
    status: 'active' as const,
    createdBy: 'user_1',
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T00:00:00.000Z',
  };

  it('parses a valid environment', () => {
    expect(() => EnvironmentSchema.parse(base)).not.toThrow();
  });

  it('rejects an invalid slug (uppercase)', () => {
    expect(() => EnvironmentSchema.parse({ ...base, slug: 'PROD' })).toThrow();
  });

  it('rejects a slug longer than 63 characters', () => {
    expect(() => EnvironmentSchema.parse({ ...base, slug: 'a'.repeat(64) })).toThrow();
  });

  it('rejects a non-UUID id', () => {
    expect(() => EnvironmentSchema.parse({ ...base, id: 'not-a-uuid' })).toThrow();
  });

  it('defaults isDefault to false when omitted', () => {
    const { isDefault: _d, ...rest } = base;
    const parsed = EnvironmentSchema.parse(rest);
    expect(parsed.isDefault).toBe(false);
  });
});

describe('EnvironmentDatabaseSchema', () => {
  it('accepts turso URL', () => {
    expect(() =>
      EnvironmentDatabaseSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        environmentId: '550e8400-e29b-41d4-a716-446655440001',
        databaseName: 'env-abc',
        databaseUrl: 'https://env-abc.turso.io',
        driver: 'turso',
        region: 'us-east-1',
        storageLimitMb: 1024,
        provisionedAt: '2026-04-19T00:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects a non-positive storage limit', () => {
    expect(() =>
      EnvironmentDatabaseSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        environmentId: '550e8400-e29b-41d4-a716-446655440001',
        databaseName: 'env-abc',
        databaseUrl: 'https://env-abc.turso.io',
        driver: 'turso',
        region: 'us-east-1',
        storageLimitMb: 0,
        provisionedAt: '2026-04-19T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('DatabaseCredentialSchema', () => {
  it('parses a valid active credential', () => {
    const cred = DatabaseCredentialSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      environmentId: '550e8400-e29b-41d4-a716-446655440001',
      secretCiphertext: 'ciphertext',
      encryptionKeyId: 'kms-key-1',
      createdAt: '2026-04-19T00:00:00.000Z',
    });
    expect(cred.status).toBe('active');
    expect(cred.authorization).toBe('full_access');
  });

  it('rejects unknown status', () => {
    expect(() =>
      DatabaseCredentialSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        environmentId: '550e8400-e29b-41d4-a716-446655440001',
        secretCiphertext: 'ciphertext',
        encryptionKeyId: 'kms-key-1',
        createdAt: '2026-04-19T00:00:00.000Z',
        status: 'bogus',
      }),
    ).toThrow();
  });

  it('accepts the full rotation status set', () => {
    for (const s of ['active', 'rotating', 'revoked']) {
      expect(() => DatabaseCredentialStatusSchema.parse(s)).not.toThrow();
    }
  });
});

describe('EnvironmentMemberSchema', () => {
  it('accepts canonical roles', () => {
    for (const r of ['owner', 'admin', 'maker', 'reader', 'guest']) {
      expect(() => EnvironmentRoleSchema.parse(r)).not.toThrow();
    }
  });

  it('parses a valid member row', () => {
    expect(() =>
      EnvironmentMemberSchema.parse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        environmentId: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user_1',
        role: 'admin',
        invitedBy: 'user_0',
        createdAt: '2026-04-19T00:00:00.000Z',
        updatedAt: '2026-04-19T00:00:00.000Z',
      }),
    ).not.toThrow();
  });
});

describe('ProvisionEnvironmentRequestSchema', () => {
  it('accepts a minimal request', () => {
    expect(() =>
      ProvisionEnvironmentRequestSchema.parse({
        organizationId: 'org_1',
        slug: 'dev',
        envType: 'development',
        createdBy: 'user_1',
      }),
    ).not.toThrow();
  });

  it('rejects a slug with invalid characters', () => {
    expect(() =>
      ProvisionEnvironmentRequestSchema.parse({
        organizationId: 'org_1',
        slug: 'DEV!',
        envType: 'development',
        createdBy: 'user_1',
      }),
    ).toThrow();
  });
});

describe('ProvisionOrganizationRequestSchema', () => {
  it('applies defaults for envType and slug', () => {
    const parsed = ProvisionOrganizationRequestSchema.parse({
      organizationId: 'org_1',
      createdBy: 'user_1',
    });
    expect(parsed.defaultEnvType).toBe('production');
    expect(parsed.defaultEnvSlug).toBe('prod');
  });
});

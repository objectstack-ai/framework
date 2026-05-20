// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  EnvironmentSchema,
  EnvironmentStatusSchema,
  EnvironmentCredentialSchema,
  EnvironmentCredentialStatusSchema,
  EnvironmentMemberSchema,
  EnvironmentRoleSchema,
  ProvisionEnvironmentRequestSchema,
  ProvisionOrganizationRequestSchema,
} from './environment.zod';
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
    displayName: 'Production',
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

  it('rejects a non-UUID id', () => {
    expect(() => EnvironmentSchema.parse({ ...base, id: 'not-a-uuid' })).toThrow();
  });

  it('defaults isDefault to false when omitted', () => {
    const { isDefault: _d, ...rest } = base;
    const parsed = EnvironmentSchema.parse(rest);
    expect(parsed.isDefault).toBe(false);
  });

  it('does not define a slug, envType, or region field', () => {
    const parsed = EnvironmentSchema.parse(base);
    expect((parsed as any).slug).toBeUndefined();
    expect((parsed as any).envType).toBeUndefined();
    expect((parsed as any).region).toBeUndefined();
  });

  it('defaults visibility to private', () => {
    const parsed = EnvironmentSchema.parse(base);
    expect(parsed.visibility).toBe('private');
  });

  it('accepts pre-computed consoleUrl and apiBaseUrl', () => {
    const parsed = EnvironmentSchema.parse({
      ...base,
      hostname: 'acme-prod.objectstack.app',
      consoleUrl: 'https://acme-prod.objectstack.app/_console',
      apiBaseUrl: 'https://acme-prod.objectstack.app/api/v1',
    });
    expect(parsed.consoleUrl).toBe('https://acme-prod.objectstack.app/_console');
    expect(parsed.apiBaseUrl).toBe('https://acme-prod.objectstack.app/api/v1');
  });
});

describe('EnvironmentCredentialSchema', () => {
  it('parses a valid active credential', () => {
    const cred = EnvironmentCredentialSchema.parse({
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
      EnvironmentCredentialSchema.parse({
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
      expect(() => EnvironmentCredentialStatusSchema.parse(s)).not.toThrow();
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
  it('accepts a minimal request (only organizationId + displayName + createdBy)', () => {
    expect(() =>
      ProvisionEnvironmentRequestSchema.parse({
        organizationId: 'org_1',
        displayName: 'Alice dev',
        createdBy: 'user_1',
      }),
    ).not.toThrow();
  });

  it('rejects a request missing displayName', () => {
    expect(() =>
      ProvisionEnvironmentRequestSchema.parse({
        organizationId: 'org_1',
        createdBy: 'user_1',
      }),
    ).toThrow();
  });

  it('rejects an empty displayName', () => {
    expect(() =>
      ProvisionEnvironmentRequestSchema.parse({
        organizationId: 'org_1',
        displayName: '',
        createdBy: 'user_1',
      }),
    ).toThrow();
  });
});

describe('ProvisionOrganizationRequestSchema', () => {
  it('applies default defaultEnvironmentDisplayName', () => {
    const parsed = ProvisionOrganizationRequestSchema.parse({
      organizationId: 'org_1',
      createdBy: 'user_1',
    });
    expect(parsed.defaultEnvironmentDisplayName).toBe('Production');
  });
});

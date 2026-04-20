// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import {
  EnvironmentProvisioningService,
  MockEnvironmentDatabaseAdapter,
  NoopSecretEncryptor,
  type EnvironmentDatabaseAdapter,
} from '../src/environment-provisioning';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('EnvironmentProvisioningService.provisionEnvironment', () => {
  it('returns a fully-formed environment + credential in detached mode', async () => {
    const svc = new EnvironmentProvisioningService({
      defaultRegion: 'eu-west-1',
      defaultStorageLimitMb: 2048,
    });

    const result = await svc.provisionEnvironment({
      organizationId: 'org-123',
      slug: 'dev',
      envType: 'development',
      createdBy: 'user-1',
    });

    expect(result.environment.id).toMatch(UUID_RE);
    expect(result.environment.organizationId).toBe('org-123');
    expect(result.environment.slug).toBe('dev');
    expect(result.environment.envType).toBe('development');
    expect(result.environment.region).toBe('eu-west-1');
    expect(result.environment.status).toBe('active');
    expect(result.environment.isDefault).toBe(false);

    // Database addressing is now on the environment row
    expect(result.environment.storageLimitMb).toBe(2048);
    expect(result.environment.databaseDriver).toBe('turso');
    expect(result.environment.databaseUrl).toContain('libsql://');

    expect(result.credential.environmentId).toBe(result.environment.id);
    expect(result.credential.status).toBe('active');
    expect(result.credential.authorization).toBe('full_access');
    expect(result.credential.encryptionKeyId).toBe('noop');

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // Detached mode must warn that control plane was not written.
    expect(result.warnings?.some((w) => w.includes('Control-plane driver'))).toBe(true);
  });

  it('persists control-plane rows when a driver is configured', async () => {
    const created: Array<{ object: string; data: Record<string, unknown> }> = [];
    const driver = {
      create: vi.fn(async (object: string, data: Record<string, unknown>) => {
        created.push({ object, data });
        return data;
      }),
      find: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    };

    const svc = new EnvironmentProvisioningService({
      controlPlaneDriver: driver as any,
      adapters: [new MockEnvironmentDatabaseAdapter('turso')],
    });

    const result = await svc.provisionEnvironment({
      organizationId: 'org-42',
      slug: 'prod',
      envType: 'production',
      isDefault: true,
      createdBy: 'user-1',
    });

    const objects = created.map((c) => c.object);
    expect(objects).toEqual(['environment', 'database_credential']);

    const envRow = created.find((c) => c.object === 'environment')!.data;
    expect(envRow.organization_id).toBe('org-42');
    expect(envRow.is_default).toBe(true);
    expect(envRow.slug).toBe('prod');
    expect(envRow.database_url).toBeTruthy();
    expect(envRow.database_driver).toBe('turso');

    expect(result.warnings).toBeUndefined();
  });

  it('rejects a second default environment for the same org', async () => {
    const driver = {
      find: vi.fn(async () => [{ id: 'existing-env-id' }]),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    };

    const svc = new EnvironmentProvisioningService({
      controlPlaneDriver: driver as any,
    });

    await expect(
      svc.provisionEnvironment({
        organizationId: 'org-42',
        slug: 'prod-2',
        envType: 'production',
        isDefault: true,
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(/already has a default environment/);

    expect(driver.create).not.toHaveBeenCalled();
  });

  it('routes through the registered adapter for the requested driver', async () => {
    const calls: string[] = [];
    const customAdapter: EnvironmentDatabaseAdapter = {
      driver: 'postgres',
      async createDatabase({ databaseName }) {
        calls.push(databaseName);
        return {
          databaseUrl: `postgres://user:pass@host/${databaseName}`,
          plaintextSecret: 'pg-secret',
        };
      },
    };

    const svc = new EnvironmentProvisioningService({ adapters: [customAdapter] });

    const result = await svc.provisionEnvironment({
      organizationId: 'org-pg',
      slug: 'prod',
      envType: 'production',
      driver: 'postgres',
      createdBy: 'user-1',
    });

    expect(calls).toHaveLength(1);
    expect(result.environment.databaseDriver).toBe('postgres');
    expect(result.environment.databaseUrl).toMatch(/^postgres:\/\//);
  });

  it('warns and falls back to mock addressing when driver has no adapter', async () => {
    const svc = new EnvironmentProvisioningService();
    const result = await svc.provisionEnvironment({
      organizationId: 'org-x',
      slug: 'prod',
      envType: 'production',
      driver: 'unknown-driver',
      createdBy: 'user-1',
    });

    expect(result.environment.databaseDriver).toBe('unknown-driver');
    expect(result.warnings?.some((w) => w.includes('No adapter registered'))).toBe(true);
  });

  it('encrypts the credential plaintext via the configured encryptor', async () => {
    const encrypt = vi.fn((s: string) => `enc(${s})`);
    const svc = new EnvironmentProvisioningService({
      encryptor: {
        keyId: 'kms-key-42',
        encrypt,
        decrypt: (s: string) => s,
      },
    });

    const result = await svc.provisionEnvironment({
      organizationId: 'org-1',
      slug: 'prod',
      envType: 'production',
      createdBy: 'user-1',
    });

    expect(encrypt).toHaveBeenCalledTimes(1);
    expect(result.credential.secretCiphertext.startsWith('enc(')).toBe(true);
    expect(result.credential.encryptionKeyId).toBe('kms-key-42');
  });
});

describe('EnvironmentProvisioningService.provisionOrganization', () => {
  it('creates a default production environment', async () => {
    const svc = new EnvironmentProvisioningService();
    const result = await svc.provisionOrganization({
      organizationId: 'org-boot',
      createdBy: 'user-boot',
    } as any);

    expect(result.defaultEnvironment.environment.isDefault).toBe(true);
    expect(result.defaultEnvironment.environment.envType).toBe('production');
    expect(result.defaultEnvironment.environment.slug).toBe('prod');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('honors custom slug / env type / plan', async () => {
    const svc = new EnvironmentProvisioningService();
    const result = await svc.provisionOrganization({
      organizationId: 'org-boot-2',
      defaultEnvSlug: 'main',
      defaultEnvType: 'staging',
      plan: 'pro',
      createdBy: 'user-boot',
    } as any);

    expect(result.defaultEnvironment.environment.slug).toBe('main');
    expect(result.defaultEnvironment.environment.envType).toBe('staging');
    expect(result.defaultEnvironment.environment.plan).toBe('pro');
  });
});

describe('EnvironmentProvisioningService.rotateCredential', () => {
  it('revokes previous active credentials and creates a new one', async () => {
    const active = [{ id: 'cred-old-1' }, { id: 'cred-old-2' }];
    const created: Record<string, unknown>[] = [];
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    const driver = {
      find: vi.fn(async () => active),
      create: vi.fn(async (_object: string, data: Record<string, unknown>) => {
        created.push(data);
        return data;
      }),
      update: vi.fn(async (_object: string, id: string, patch: Record<string, unknown>) => {
        updates.push({ id, patch });
        return patch;
      }),
    };

    const svc = new EnvironmentProvisioningService({
      controlPlaneDriver: driver as any,
      encryptor: new NoopSecretEncryptor(),
    });

    const fresh = await svc.rotateCredential('env-1', 'new-plaintext');

    expect(fresh.status).toBe('active');
    expect(fresh.secretCiphertext).toBe('new-plaintext'); // noop encryptor
    expect(created).toHaveLength(1);
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.patch.status === 'revoked' && u.patch.revoked_at)).toBe(true);
  });

  it('throws when no control-plane driver is configured', async () => {
    const svc = new EnvironmentProvisioningService();
    await expect(svc.rotateCredential('env-1', 'pt')).rejects.toThrow(
      /control-plane driver required/i,
    );
  });
});

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import {
  ProjectProvisioningService,
  MockProjectDatabaseAdapter,
  NoopSecretEncryptor,
  type ProjectDatabaseAdapter,
} from './project-provisioning.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SYSTEM_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000000';

describe('ProjectProvisioningService.provisionProject', () => {
  it('returns a fully-formed project + credential in detached mode', async () => {
    const svc = new ProjectProvisioningService({
      defaultRegion: 'eu-west-1',
      defaultStorageLimitMb: 2048,
    });

    const result = await svc.provisionProject({
      organizationId: 'org-123',
      slug: 'dev',
      projectType: 'development',
      createdBy: 'user-1',
    });

    expect(result.project.id).toMatch(UUID_RE);
    expect(result.project.organizationId).toBe('org-123');
    expect(result.project.slug).toBe('dev');
    expect(result.project.projectType).toBe('development');
    expect(result.project.region).toBe('eu-west-1');
    expect(result.project.status).toBe('active');
    expect(result.project.isDefault).toBe(false);
    expect(result.project.isSystem).toBe(false);

    // Database addressing is on the project row
    expect(result.project.storageLimitMb).toBe(2048);
    expect(result.project.databaseDriver).toBe('turso');
    expect(result.project.databaseUrl).toContain('libsql://');

    expect(result.credential.projectId).toBe(result.project.id);
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
      findOne: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    };

    const svc = new ProjectProvisioningService({
      controlPlaneDriver: driver as any,
      adapters: [new MockProjectDatabaseAdapter('turso')],
    });

    const result = await svc.provisionProject({
      organizationId: 'org-42',
      slug: 'prod',
      projectType: 'production',
      isDefault: true,
      createdBy: 'user-1',
    });

    const objects = created.map((c) => c.object);
    expect(objects).toEqual(['project', 'project_credential']);

    const projectRow = created.find((c) => c.object === 'project')!.data;
    expect(projectRow.organization_id).toBe('org-42');
    expect(projectRow.is_default).toBe(true);
    expect(projectRow.is_system).toBe(false);
    expect(projectRow.slug).toBe('prod');
    expect(projectRow.database_url).toBeTruthy();
    expect(projectRow.database_driver).toBe('turso');

    expect(result.warnings).toBeUndefined();
  });

  it('rejects a second default project for the same org', async () => {
    const driver = {
      find: vi.fn(async () => [{ id: 'existing-project-id' }]),
      findOne: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    };

    const svc = new ProjectProvisioningService({
      controlPlaneDriver: driver as any,
    });

    await expect(
      svc.provisionProject({
        organizationId: 'org-42',
        slug: 'prod-2',
        projectType: 'production',
        isDefault: true,
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(/already has a default project/);

    expect(driver.create).not.toHaveBeenCalled();
  });
});

describe('ProjectProvisioningService.provisionSystemProject', () => {
  it('creates system project with well-known UUID in detached mode', async () => {
    const svc = new ProjectProvisioningService({
      defaultRegion: 'us-east-1',
    });

    const result = await svc.provisionSystemProject();

    expect(result.project.id).toBe(SYSTEM_PROJECT_ID);
    expect(result.project.organizationId).toBe(PLATFORM_ORG_ID);
    expect(result.project.slug).toBe('system');
    expect(result.project.displayName).toBe('System');
    expect(result.project.projectType).toBe('production');
    expect(result.project.isDefault).toBe(false);
    expect(result.project.isSystem).toBe(true);
    expect(result.project.plan).toBe('enterprise');
    expect(result.project.status).toBe('active');
    expect(result.project.createdBy).toBe('system');
    expect(result.project.hostname).toBe('system.objectstack.internal');

    // System project uses control plane DB - no separate physical DB
    expect(result.project.databaseUrl).toBeUndefined();
    expect(result.project.databaseDriver).toBeUndefined();
    expect(result.project.storageLimitMb).toBeUndefined();

    expect(result.credential.projectId).toBe(SYSTEM_PROJECT_ID);
    expect(result.credential.secretCiphertext).toBe('');

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('persists system project to control plane when driver is configured', async () => {
    const created: Array<{ object: string; data: Record<string, unknown> }> = [];
    const driver = {
      create: vi.fn(async (object: string, data: Record<string, unknown>) => {
        created.push({ object, data });
        return data;
      }),
      find: vi.fn(async () => []),
      findOne: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    };

    const svc = new ProjectProvisioningService({
      controlPlaneDriver: driver as any,
    });

    const result = await svc.provisionSystemProject();

    expect(created).toHaveLength(1);
    const projectRow = created[0].data;

    expect(created[0].object).toBe('project');
    expect(projectRow.id).toBe(SYSTEM_PROJECT_ID);
    expect(projectRow.organization_id).toBe(PLATFORM_ORG_ID);
    expect(projectRow.slug).toBe('system');
    expect(projectRow.is_system).toBe(true);
    expect(projectRow.is_default).toBe(false);
    expect(projectRow.plan).toBe('enterprise');
    expect(projectRow.database_url).toBeUndefined();

    expect(result.warnings?.some((w) => w.includes('created successfully'))).toBe(true);
  });

  it('returns existing system project if already created (idempotent)', async () => {
    const findOneCalled: string[] = [];
    const driver = {
      create: vi.fn(async () => ({})),
      find: vi.fn(async () => []),
      findOne: vi.fn(async (object: string, query: any) => {
        findOneCalled.push(object);
        if (object === 'project' && query.where?.id === SYSTEM_PROJECT_ID) {
          return {
            id: SYSTEM_PROJECT_ID,
            organization_id: PLATFORM_ORG_ID,
            slug: 'system',
            display_name: 'System',
            project_type: 'production',
            is_default: false,
            is_system: true,
            region: 'us-east-1',
            plan: 'enterprise',
            status: 'active',
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            provisioned_at: new Date().toISOString(),
            hostname: 'system.objectstack.internal',
          };
        }
        return null;
      }),
      update: vi.fn(async () => ({})),
    };

    const svc = new ProjectProvisioningService({
      controlPlaneDriver: driver as any,
    });

    const result = await svc.provisionSystemProject();

    // Should have queried for existing system project
    expect(findOneCalled).toContain('project');

    // Should NOT have called create since project exists
    expect(driver.create).not.toHaveBeenCalled();

    // Should return the existing project
    expect(result.project.id).toBe(SYSTEM_PROJECT_ID);
    expect(result.project.isSystem).toBe(true);
    expect(result.warnings).toContain('System project already exists');
  });

  it('metadata field contains expected system project metadata', async () => {
    const svc = new ProjectProvisioningService();

    const result = await svc.provisionSystemProject();

    expect(result.project.metadata).toBeDefined();
    expect(result.project.metadata?.description).toBe('Built-in system project for platform infrastructure');
    expect(result.project.metadata?.protected).toBe(true);
  });
});

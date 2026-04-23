// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import type { Contracts } from '@objectstack/spec';
type IDataDriver = Contracts.IDataDriver;
import type {
  ProjectCredential,
  ProjectDriver,
  Project,
  ProvisionProjectRequest,
  ProvisionProjectResponse,
  ProvisionOrganizationRequest,
  ProvisionOrganizationResponse,
} from '@objectstack/spec/cloud';
import { ProvisionProjectRequestSchema, ProvisionOrganizationRequestSchema } from '@objectstack/spec/cloud';
import { TursoPlatformClient } from './turso-platform-client.js';

/**
 * Backend-agnostic physical DB provisioning adapter.
 *
 * Implementations wrap provider APIs (Turso Platform, Neon, Supabase,
 * raw SQLite file, …). The provisioning service only talks to this
 * interface, so new drivers can be plugged in without touching the
 * higher-level orchestration logic.
 */
export interface ProjectDatabaseAdapter {
  /** Driver key this adapter answers to (e.g. `turso`, `libsql`, `sqlite`, `postgres`). */
  readonly driver: ProjectDriver;

  /**
   * Allocate a fresh physical database for the given project.
   * Must return the public `databaseUrl` and the plaintext credential
   * secret; the orchestrator will encrypt the secret before storing it.
   */
  createDatabase(params: {
    projectId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }>;
}

/**
 * Secret encryption hook — abstracts away the KMS / envelope-encryption
 * implementation so tests and dev environments can use a no-op while
 * production uses a real KMS.
 */
export interface SecretEncryptor {
  /** Stable key ID stored alongside the ciphertext for rotation tracking. */
  readonly keyId: string;
  encrypt(plaintext: string): Promise<string> | string;
  decrypt(ciphertext: string): Promise<string> | string;
}

/**
 * No-op encryptor used in development / tests. **Never** use in production.
 */
export class NoopSecretEncryptor implements SecretEncryptor {
  readonly keyId = 'noop';
  encrypt(plaintext: string): string {
    return plaintext;
  }
  decrypt(ciphertext: string): string {
    return ciphertext;
  }
}

/**
 * Turso Platform adapter — calls the Turso Platform API to provision a new
 * cloud database for each project, then mints a per-database auth token.
 *
 * Required env vars: `TURSO_ORG_NAME`, `TURSO_API_TOKEN`.
 */
export class TursoProjectDatabaseAdapter implements ProjectDatabaseAdapter {
  readonly driver: ProjectDriver = 'turso';

  private readonly client: TursoPlatformClient;
  private readonly group: string;

  constructor(config: { apiToken: string; organization: string; group?: string; apiBaseUrl?: string }) {
    this.client = new TursoPlatformClient(config);
    this.group = config.group ?? 'default';
  }

  async createDatabase(params: {
    projectId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    await this.client.createDatabase({ name: params.databaseName, group: this.group });
    const { jwt } = await this.client.createDatabaseToken(params.databaseName, {
      authorization: 'full-access',
    });
    const db = await this.client.getDatabase(params.databaseName);
    return {
      databaseUrl: `libsql://${db.Hostname}`,
      plaintextSecret: jwt,
    };
  }
}

/**
 * Local SQLite adapter for development projects. Creates one `.db` file
 * per project under `baseDir`, named after the stable `databaseName`
 * (e.g. `proj-{uuid}.db`) so the file survives slug renames.
 */
export class LocalSQLiteProjectDatabaseAdapter implements ProjectDatabaseAdapter {
  readonly driver: ProjectDriver;

  constructor(
    private readonly baseDir: string = '.objectstack/data/projects',
    driver: ProjectDriver = 'sqlite',
  ) {
    this.driver = driver;
  }

  async createDatabase(params: {
    projectId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    const { mkdirSync, writeFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const dbPath = resolve(this.baseDir, `${params.databaseName}.db`);
    mkdirSync(this.baseDir, { recursive: true });
    if (!existsSync(dbPath)) writeFileSync(dbPath, '');
    return {
      databaseUrl: `file:${dbPath}`,
      plaintextSecret: '',
    };
  }
}

/**
 * In-memory project adapter. Pre-creates an empty JSON shell under
 * `baseDir` so the per-project snapshot is visible on disk immediately
 * after provisioning; the runtime's memory-driver factory points its
 * `FileSystemPersistenceAdapter` at the same file, which seeding and
 * subsequent writes then populate.
 */
export class MemoryProjectDatabaseAdapter implements ProjectDatabaseAdapter {
  readonly driver: ProjectDriver = 'memory';

  constructor(private readonly baseDir: string = '.objectstack/data/projects') {}

  async createDatabase(params: {
    projectId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    try {
      const { mkdirSync, writeFileSync, existsSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const filePath = resolve(this.baseDir, `${params.databaseName}.json`);
      mkdirSync(this.baseDir, { recursive: true });
      if (!existsSync(filePath)) writeFileSync(filePath, '{}');
    } catch {
      // Non-fatal — the memory driver will recreate the file on first flush.
    }
    return {
      databaseUrl: `memory://${params.databaseName}`,
      plaintextSecret: '',
    };
  }
}

/**
 * Mock adapter used by dev/test environments when no real provider is
 * configured. Returns stable synthetic URLs / tokens.
 */
export class MockProjectDatabaseAdapter implements ProjectDatabaseAdapter {
  readonly driver: ProjectDriver;
  constructor(driver: ProjectDriver = 'turso') {
    this.driver = driver;
  }
  async createDatabase(params: {
    projectId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    return {
      databaseUrl: `libsql://${params.databaseName}.mock-${this.driver}.local`,
      plaintextSecret: `mock-token-${params.projectId}`,
    };
  }
}

/**
 * Configuration for {@link ProjectProvisioningService}.
 */
export interface ProjectProvisioningConfig {
  /**
   * Control-plane data driver used to persist `sys_project` and
   * `sys_project_credential` rows.
   *
   * Optional: when omitted, the service runs in **detached** mode —
   * useful for tests that only exercise the orchestration logic.
   */
  controlPlaneDriver?: IDataDriver;

  /**
   * Registered physical-DB adapters keyed by driver name. The service
   * picks an adapter by matching `request.driver` (falling back to
   * `defaultDriver`).
   */
  adapters?: ProjectDatabaseAdapter[];

  /** Driver used when the request does not specify one. Default `turso`. */
  defaultDriver?: ProjectDriver;

  /** Default region when the request does not specify one. */
  defaultRegion?: string;

  /** Default storage quota in MB when not specified. */
  defaultStorageLimitMb?: number;

  /** Secret encryptor. Defaults to {@link NoopSecretEncryptor} (**dev-only**). */
  encryptor?: SecretEncryptor;
}

/**
 * Project Provisioning Service
 *
 * Orchestrates the "project per database" model:
 *
 *   1. `provisionOrganization(req)`
 *        → creates the organization's default project + its dedicated DB.
 *   2. `provisionProject(req)`
 *        → allocates a new project (prod / test / dev / sandbox / …)
 *          with its own physical DB and credential row.
 *
 * The Control Plane's responsibilities end at "project connection
 * metadata and authentication". It never touches data-plane rows.
 */
export class ProjectProvisioningService {
  private readonly config: Required<
    Pick<ProjectProvisioningConfig, 'defaultDriver' | 'defaultRegion' | 'defaultStorageLimitMb'>
  > &
    Omit<ProjectProvisioningConfig, 'defaultDriver' | 'defaultRegion' | 'defaultStorageLimitMb'>;

  private readonly adapters = new Map<ProjectDriver, ProjectDatabaseAdapter>();

  private readonly encryptor: SecretEncryptor;

  constructor(config: ProjectProvisioningConfig = {}) {
    this.config = {
      controlPlaneDriver: config.controlPlaneDriver,
      adapters: config.adapters,
      encryptor: config.encryptor,
      defaultDriver: config.defaultDriver ?? 'turso',
      defaultRegion: config.defaultRegion ?? 'us-east-1',
      defaultStorageLimitMb: config.defaultStorageLimitMb ?? 1024,
    };

    for (const adapter of config.adapters ?? []) {
      this.adapters.set(adapter.driver, adapter);
    }

    this.encryptor = config.encryptor ?? new NoopSecretEncryptor();
  }

  /**
   * Bootstrap a brand-new organization — creates the default project
   * (by default `prod`) and its physical database in one atomic call.
   */
  async provisionOrganization(
    request: ProvisionOrganizationRequest,
  ): Promise<ProvisionOrganizationResponse> {
    const parsed = ProvisionOrganizationRequestSchema.parse(request);
    const startedAt = Date.now();

    const defaultProject = await this.provisionProject({
      organizationId: parsed.organizationId,
      displayName: parsed.defaultProjectDisplayName,
      driver: parsed.driver,
      plan: parsed.plan,
      storageLimitMb: parsed.storageLimitMb,
      isDefault: true,
      createdBy: parsed.createdBy,
      metadata: parsed.metadata,
    });

    return {
      defaultProject,
      durationMs: Date.now() - startedAt,
      warnings: defaultProject.warnings,
    };
  }

  /**
   * Provision a new project (dev/test/prod/sandbox/…) for an
   * existing organization. Allocates a fresh physical database and mints
   * an encrypted credential row.
   */
  async provisionProject(
    request: ProvisionProjectRequest,
  ): Promise<ProvisionProjectResponse> {
    const parsed = ProvisionProjectRequestSchema.parse(request);
    const startedAt = Date.now();
    const warnings: string[] = [];

    const projectId = randomUUID();
    const credentialId = randomUUID();

    const driver: ProjectDriver = parsed.driver ?? this.config.defaultDriver;
    const region = this.config.defaultRegion;
    const storageLimitMb = parsed.storageLimitMb ?? this.config.defaultStorageLimitMb;
    // Turso requires database names ≤ 26 chars; use 'p-' prefix + first 24 hex chars
    const databaseName = `p-${projectId.replace(/-/g, '').slice(0, 24)}`;

    // Enforce "exactly one default project per org" invariant.
    if (parsed.isDefault && this.config.controlPlaneDriver) {
      const existingDefault = await this.findDefaultProject(parsed.organizationId);
      if (existingDefault) {
        throw new Error(
          `Organization ${parsed.organizationId} already has a default project (${existingDefault.id}). Demote it first.`,
        );
      }
    }

    // Allocate physical DB via the adapter.
    const adapter = this.resolveAdapter(driver);
    let databaseUrl: string;
    let plaintextSecret: string;
    if (adapter) {
      try {
        const created = await adapter.createDatabase({
          projectId,
          databaseName,
          region,
          storageLimitMb,
        });
        databaseUrl = created.databaseUrl;
        plaintextSecret = created.plaintextSecret;
      } catch (error) {
        throw new Error(
          `Failed to provision physical database for project ${projectId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      const fallback = await new MockProjectDatabaseAdapter(driver).createDatabase({
        projectId,
        databaseName,
        region,
        storageLimitMb,
      });
      databaseUrl = fallback.databaseUrl;
      plaintextSecret = fallback.plaintextSecret;
      warnings.push(
        `No adapter registered for driver "${driver}"; project provisioned with mock addressing.`,
      );
    }

    const nowIso = new Date().toISOString();
    const project: Project = {
      id: projectId,
      organizationId: parsed.organizationId,
      displayName: parsed.displayName,
      isDefault: parsed.isDefault ?? false,
      isSystem: false, // Regular projects are not system projects
      plan: parsed.plan ?? 'free',
      status: 'active',
      createdBy: parsed.createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
      metadata: parsed.metadata,
      databaseUrl,
      databaseDriver: driver,
      storageLimitMb,
      provisionedAt: nowIso,
      hostname: parsed.hostname,
    };

    const credential: ProjectCredential = {
      id: credentialId,
      projectId,
      secretCiphertext: await Promise.resolve(this.encryptor.encrypt(plaintextSecret)),
      encryptionKeyId: this.encryptor.keyId,
      authorization: 'full_access',
      status: 'active',
      createdAt: nowIso,
    };

    // Persist to the control plane.
    if (this.config.controlPlaneDriver) {
      try {
        await this.config.controlPlaneDriver.create('project', {
          id: project.id,
          organization_id: project.organizationId,
          display_name: project.displayName,
          is_default: project.isDefault,
          is_system: project.isSystem,
          plan: project.plan,
          status: project.status,
          created_by: project.createdBy,
          created_at: project.createdAt,
          updated_at: project.updatedAt,
          database_url: project.databaseUrl,
          database_driver: project.databaseDriver,
          storage_limit_mb: project.storageLimitMb,
          provisioned_at: project.provisionedAt,
          metadata: project.metadata ? JSON.stringify(project.metadata) : null,
          hostname: project.hostname,
        });

        await this.config.controlPlaneDriver.create('project_credential', {
          id: credential.id,
          project_id: credential.projectId,
          secret_ciphertext: credential.secretCiphertext,
          encryption_key_id: credential.encryptionKeyId,
          authorization: credential.authorization,
          status: credential.status,
          created_at: credential.createdAt,
          updated_at: nowIso,
        });
      } catch (error) {
        warnings.push(
          `Failed to persist control-plane rows: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      warnings.push('Control-plane driver not configured — project records not persisted.');
    }

    return {
      project,
      credential,
      durationMs: Date.now() - startedAt,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Rotate the credential for a project.
   */
  async rotateCredential(
    projectId: string,
    plaintextSecret: string,
  ): Promise<ProjectCredential> {
    if (!this.config.controlPlaneDriver) {
      throw new Error('Control-plane driver required for credential rotation.');
    }

    const nowIso = new Date().toISOString();
    const newCredentialId = randomUUID();

    const credential: ProjectCredential = {
      id: newCredentialId,
      projectId,
      secretCiphertext: await Promise.resolve(this.encryptor.encrypt(plaintextSecret)),
      encryptionKeyId: this.encryptor.keyId,
      authorization: 'full_access',
      status: 'active',
      createdAt: nowIso,
    };

    // Revoke existing active credentials.
    const existing = (await this.config.controlPlaneDriver.find('project_credential', {
      where: { project_id: projectId, status: 'active' },
    } as any)) as Array<{ id: string }>;

    for (const row of existing ?? []) {
      await this.config.controlPlaneDriver.update('project_credential', row.id, {
        status: 'revoked',
        revoked_at: nowIso,
        updated_at: nowIso,
      });
    }

    await this.config.controlPlaneDriver.create('project_credential', {
      id: credential.id,
      project_id: credential.projectId,
      secret_ciphertext: credential.secretCiphertext,
      encryption_key_id: credential.encryptionKeyId,
      authorization: credential.authorization,
      status: credential.status,
      created_at: credential.createdAt,
      updated_at: nowIso,
    });

    return credential;
  }

  /**
   * Provision the built-in system project during platform bootstrap.
   * This project contains system-level packages and operates on the control plane DB.
   *
   * @returns The provisioned system project or existing if already created (idempotent)
   */
  async provisionSystemProject(): Promise<ProvisionProjectResponse> {
    const SYSTEM_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
    const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000000';
    const startedAt = Date.now();
    const warnings: string[] = [];

    // Check if system project already exists (idempotent operation)
    if (this.config.controlPlaneDriver) {
      try {
        const existing = await this.config.controlPlaneDriver.findOne('project', {
          where: { id: SYSTEM_PROJECT_ID },
        });

        if (existing) {
          // System project already exists - return it
          const credentialId = randomUUID();
          const nowIso = new Date().toISOString();

          return {
            project: {
              id: existing.id,
              organizationId: existing.organization_id,
              displayName: existing.display_name,
              isDefault: existing.is_default,
              isSystem: existing.is_system ?? true,
              plan: existing.plan,
              status: existing.status,
              createdBy: existing.created_by,
              createdAt: existing.created_at,
              updatedAt: existing.updated_at,
              databaseUrl: existing.database_url,
              databaseDriver: existing.database_driver,
              storageLimitMb: existing.storage_limit_mb,
              provisionedAt: existing.provisioned_at,
              metadata: existing.metadata ? JSON.parse(existing.metadata) : undefined,
              hostname: existing.hostname,
            },
            credential: {
              id: credentialId,
              projectId: SYSTEM_PROJECT_ID,
              secretCiphertext: '',
              encryptionKeyId: this.encryptor.keyId,
              authorization: 'full_access',
              status: 'active',
              createdAt: nowIso,
            },
            durationMs: Date.now() - startedAt,
            warnings: ['System project already exists'],
          };
        }
      } catch (error) {
        // Project not found - proceed with creation
      }
    }

    // Create new system project
    const nowIso = new Date().toISOString();
    const credentialId = randomUUID();

    const project: Project = {
      id: SYSTEM_PROJECT_ID,
      organizationId: PLATFORM_ORG_ID,
      displayName: 'System',
      isDefault: false,
      isSystem: true,
      plan: 'enterprise',
      status: 'active',
      createdBy: 'system',
      createdAt: nowIso,
      updatedAt: nowIso,
      metadata: {
        description: 'Built-in system project for platform infrastructure',
        protected: true,
      },
      databaseUrl: undefined,
      databaseDriver: undefined,
      storageLimitMb: undefined,
      provisionedAt: nowIso,
      hostname: 'system.objectstack.internal',
    };

    const credential: ProjectCredential = {
      id: credentialId,
      projectId: SYSTEM_PROJECT_ID,
      secretCiphertext: '',
      encryptionKeyId: this.encryptor.keyId,
      authorization: 'full_access',
      status: 'active',
      createdAt: nowIso,
    };

    // Persist to control plane
    if (this.config.controlPlaneDriver) {
      try {
        await this.config.controlPlaneDriver.create('project', {
          id: project.id,
          organization_id: project.organizationId,
          display_name: project.displayName,
          is_default: project.isDefault,
          is_system: project.isSystem,
          plan: project.plan,
          status: project.status,
          created_by: project.createdBy,
          created_at: project.createdAt,
          updated_at: project.updatedAt,
          database_url: project.databaseUrl,
          database_driver: project.databaseDriver,
          storage_limit_mb: project.storageLimitMb,
          provisioned_at: project.provisionedAt,
          metadata: project.metadata ? JSON.stringify(project.metadata) : null,
          hostname: project.hostname,
        });

        warnings.push('System project created successfully');
      } catch (error) {
        throw new Error(
          `Failed to persist system project: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { project, credential, durationMs: Date.now() - startedAt, warnings };
  }

  registerAdapter(adapter: ProjectDatabaseAdapter): void {
    this.adapters.set(adapter.driver, adapter);
  }

  private resolveAdapter(driver: ProjectDriver): ProjectDatabaseAdapter | undefined {
    return this.adapters.get(driver);
  }

  private async findDefaultProject(organizationId: string): Promise<{ id: string } | null> {
    if (!this.config.controlPlaneDriver) return null;
    try {
      const rows = (await this.config.controlPlaneDriver.find('project', {
        where: { organization_id: organizationId, is_default: true },
      } as any)) as Array<{ id: string }>;
      return rows && rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  }
}

/**
 * Build the default adapter list from environment variables.
 */
export function createDefaultProjectAdapters(
  env: Record<string, string | undefined> = process.env,
): ProjectDatabaseAdapter[] {
  const adapters: ProjectDatabaseAdapter[] = [];

  // On serverless platforms (Vercel, etc.) local storage is ephemeral —
  // only cloud-backed drivers (turso) are meaningful.
  const isServerless = Boolean(env.VERCEL || env.VERCEL_ENV || env.AWS_LAMBDA_FUNCTION_NAME);

  if (!isServerless) {
    adapters.push(new MemoryProjectDatabaseAdapter());
    adapters.push(new LocalSQLiteProjectDatabaseAdapter());
  }

  const orgName = env.TURSO_ORG_NAME;
  const apiToken = env.TURSO_API_TOKEN;
  if (orgName && apiToken && orgName !== 'your-org-slug' && apiToken !== 'your-platform-api-token') {
    adapters.push(new TursoProjectDatabaseAdapter({ organization: orgName, apiToken }));
  } else if (!isServerless) {
    // Fallback turso-alias only makes sense in local dev
    adapters.push(new LocalSQLiteProjectDatabaseAdapter(undefined, 'turso'));
  }
  return adapters;
}

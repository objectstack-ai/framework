// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import type { IDataDriver } from '@objectstack/spec';
import type {
  DatabaseCredential,
  DatabaseDriver,
  Environment,
  ProvisionEnvironmentRequest,
  ProvisionEnvironmentResponse,
  ProvisionOrganizationRequest,
  ProvisionOrganizationResponse,
} from '@objectstack/spec/cloud';
import { ProvisionEnvironmentRequestSchema, ProvisionOrganizationRequestSchema } from '@objectstack/spec/cloud';
import { TursoPlatformClient } from './turso-platform-client.js';

/**
 * Backend-agnostic physical DB provisioning adapter.
 *
 * Implementations wrap provider APIs (Turso Platform, Neon, Supabase,
 * raw SQLite file, …). The provisioning service only talks to this
 * interface, so new drivers can be plugged in without touching the
 * higher-level orchestration logic.
 */
export interface EnvironmentDatabaseAdapter {
  /** Driver key this adapter answers to (e.g. `turso`, `libsql`, `sqlite`, `postgres`). */
  readonly driver: DatabaseDriver;

  /**
   * Allocate a fresh physical database for the given environment.
   * Must return the public `databaseUrl` and the plaintext credential
   * secret; the orchestrator will encrypt the secret before storing it.
   */
  createDatabase(params: {
    environmentId: string;
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
 * cloud database for each environment, then mints a per-database auth token.
 *
 * Required env vars: `TURSO_ORG_NAME`, `TURSO_API_TOKEN`.
 */
export class TursoEnvironmentDatabaseAdapter implements EnvironmentDatabaseAdapter {
  readonly driver: DatabaseDriver = 'turso';

  private readonly client: TursoPlatformClient;

  constructor(config: { apiToken: string; organization: string; apiBaseUrl?: string }) {
    this.client = new TursoPlatformClient(config);
  }

  async createDatabase(params: {
    environmentId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    await this.client.createDatabase({ name: params.databaseName });
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
 * Local SQLite adapter for development environments. Creates one `.db` file
 * per environment under `baseDir`, named after the stable `databaseName`
 * (e.g. `env-{uuid}.db`) so the file survives slug renames.
 */
export class LocalSQLiteEnvironmentDatabaseAdapter implements EnvironmentDatabaseAdapter {
  readonly driver: DatabaseDriver = 'sqlite';

  constructor(private readonly baseDir: string = '.objectstack/data/environments') {}

  async createDatabase(params: {
    environmentId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    const { mkdirSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const dbPath = resolve(this.baseDir, `${params.databaseName}.db`);
    mkdirSync(this.baseDir, { recursive: true });
    return {
      databaseUrl: `file:${dbPath}`,
      plaintextSecret: '',
    };
  }
}

/**
 * Mock adapter used by dev/test environments when no real provider is
 * configured. Returns stable synthetic URLs / tokens.
 */
export class MockEnvironmentDatabaseAdapter implements EnvironmentDatabaseAdapter {
  readonly driver: DatabaseDriver;
  constructor(driver: DatabaseDriver = 'turso') {
    this.driver = driver;
  }
  async createDatabase(params: {
    environmentId: string;
    databaseName: string;
    region: string;
    storageLimitMb: number;
  }): Promise<{ databaseUrl: string; plaintextSecret: string }> {
    return {
      databaseUrl: `libsql://${params.databaseName}.mock-${this.driver}.local`,
      plaintextSecret: `mock-token-${params.environmentId}`,
    };
  }
}

/**
 * Configuration for {@link EnvironmentProvisioningService}.
 */
export interface EnvironmentProvisioningConfig {
  /**
   * Control-plane data driver used to persist `sys_environment` and
   * `sys_database_credential` rows.
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
  adapters?: EnvironmentDatabaseAdapter[];

  /** Driver used when the request does not specify one. Default `turso`. */
  defaultDriver?: DatabaseDriver;

  /** Default region when the request does not specify one. */
  defaultRegion?: string;

  /** Default storage quota in MB when not specified. */
  defaultStorageLimitMb?: number;

  /** Secret encryptor. Defaults to {@link NoopSecretEncryptor} (**dev-only**). */
  encryptor?: SecretEncryptor;
}

/**
 * Environment Provisioning Service
 *
 * Orchestrates the v4.1+ "environment per database" model:
 *
 *   1. `provisionOrganization(req)`
 *        → creates the organization's default environment + its dedicated DB.
 *   2. `provisionEnvironment(req)`
 *        → allocates a new environment (prod / test / dev / sandbox / …)
 *          with its own physical DB and credential row.
 *
 * The Control Plane's responsibilities end at "environment connection
 * metadata and authentication". It never touches data-plane rows.
 *
 * See ADR-0002 (`docs/adr/0002-environment-database-isolation.md`).
 */
export class EnvironmentProvisioningService {
  private readonly config: Required<
    Pick<EnvironmentProvisioningConfig, 'defaultDriver' | 'defaultRegion' | 'defaultStorageLimitMb'>
  > &
    Omit<EnvironmentProvisioningConfig, 'defaultDriver' | 'defaultRegion' | 'defaultStorageLimitMb'>;

  private readonly adapters = new Map<DatabaseDriver, EnvironmentDatabaseAdapter>();

  private readonly encryptor: SecretEncryptor;

  constructor(config: EnvironmentProvisioningConfig = {}) {
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
   * Bootstrap a brand-new organization — creates the default environment
   * (by default `prod`) and its physical database in one atomic call.
   */
  async provisionOrganization(
    request: ProvisionOrganizationRequest,
  ): Promise<ProvisionOrganizationResponse> {
    const parsed = ProvisionOrganizationRequestSchema.parse(request);
    const startedAt = Date.now();

    const defaultEnv = await this.provisionEnvironment({
      organizationId: parsed.organizationId,
      slug: parsed.defaultEnvSlug,
      displayName: parsed.defaultEnvSlug === 'prod' ? 'Production' : parsed.defaultEnvSlug,
      envType: parsed.defaultEnvType,
      region: parsed.region,
      driver: parsed.driver,
      plan: parsed.plan,
      storageLimitMb: parsed.storageLimitMb,
      isDefault: true,
      createdBy: parsed.createdBy,
      metadata: parsed.metadata,
    });

    return {
      defaultEnvironment: defaultEnv,
      durationMs: Date.now() - startedAt,
      warnings: defaultEnv.warnings,
    };
  }

  /**
   * Provision a new environment (dev/test/prod/sandbox/…) for an
   * existing organization. Allocates a fresh physical database and mints
   * an encrypted credential row.
   */
  async provisionEnvironment(
    request: ProvisionEnvironmentRequest,
  ): Promise<ProvisionEnvironmentResponse> {
    const parsed = ProvisionEnvironmentRequestSchema.parse(request);
    const startedAt = Date.now();
    const warnings: string[] = [];

    const environmentId = randomUUID();
    const credentialId = randomUUID();

    const driver: DatabaseDriver = parsed.driver ?? this.config.defaultDriver;
    const region = parsed.region ?? this.config.defaultRegion;
    const storageLimitMb = parsed.storageLimitMb ?? this.config.defaultStorageLimitMb;
    const databaseName = `env-${environmentId}`;

    // 1. Enforce the "exactly one default environment per org" invariant
    //    before minting the new row. If the caller asked for isDefault:true
    //    and one already exists, fail fast — the caller should demote the
    //    existing default first (out of scope for v4.1 API).
    if (parsed.isDefault && this.config.controlPlaneDriver) {
      const existingDefault = await this.findDefaultEnvironment(parsed.organizationId);
      if (existingDefault) {
        throw new Error(
          `Organization ${parsed.organizationId} already has a default environment (${existingDefault.id}). Demote it first.`,
        );
      }
    }

    // 2. Allocate physical DB via the adapter.
    const adapter = this.resolveAdapter(driver);
    let databaseUrl: string;
    let plaintextSecret: string;
    if (adapter) {
      try {
        const created = await adapter.createDatabase({
          environmentId,
          databaseName,
          region,
          storageLimitMb,
        });
        databaseUrl = created.databaseUrl;
        plaintextSecret = created.plaintextSecret;
      } catch (error) {
        throw new Error(
          `Failed to provision physical database for environment ${environmentId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      const fallback = await new MockEnvironmentDatabaseAdapter(driver).createDatabase({
        environmentId,
        databaseName,
        region,
        storageLimitMb,
      });
      databaseUrl = fallback.databaseUrl;
      plaintextSecret = fallback.plaintextSecret;
      warnings.push(
        `No adapter registered for driver "${driver}"; environment provisioned with mock addressing.`,
      );
    }

    const nowIso = new Date().toISOString();
    const environment: Environment = {
      id: environmentId,
      organizationId: parsed.organizationId,
      slug: parsed.slug,
      displayName: parsed.displayName ?? parsed.slug,
      envType: parsed.envType,
      isDefault: parsed.isDefault ?? false,
      region,
      plan: parsed.plan ?? 'free',
      status: 'active',
      createdBy: parsed.createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
      metadata: parsed.metadata,
      // Physical database addressing (embedded on the environment row)
      databaseUrl,
      databaseDriver: driver,
      storageLimitMb,
      provisionedAt: nowIso,
    };

    const credential: DatabaseCredential = {
      id: credentialId,
      environmentId,
      secretCiphertext: await Promise.resolve(this.encryptor.encrypt(plaintextSecret)),
      encryptionKeyId: this.encryptor.keyId,
      authorization: 'full_access',
      status: 'active',
      createdAt: nowIso,
    };

    // 3. Persist to the control plane (best-effort — callers in detached
    //    mode just get the in-memory payload).
    if (this.config.controlPlaneDriver) {
      try {
        await this.config.controlPlaneDriver.create('environment', {
          id: environment.id,
          organization_id: environment.organizationId,
          slug: environment.slug,
          display_name: environment.displayName,
          env_type: environment.envType,
          is_default: environment.isDefault,
          region: environment.region,
          plan: environment.plan,
          status: environment.status,
          created_by: environment.createdBy,
          created_at: environment.createdAt,
          updated_at: environment.updatedAt,
          database_url: environment.databaseUrl,
          database_driver: environment.databaseDriver,
          storage_limit_mb: environment.storageLimitMb,
          provisioned_at: environment.provisionedAt,
          metadata: environment.metadata ? JSON.stringify(environment.metadata) : null,
        });

        await this.config.controlPlaneDriver.create('database_credential', {
          id: credential.id,
          environment_id: credential.environmentId,
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
      warnings.push('Control-plane driver not configured — environment records not persisted.');
    }

    return {
      environment,
      credential,
      durationMs: Date.now() - startedAt,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Rotate the credential for an environment. Creates a new `active`
   * credential row and flips the previous one to `revoked`.
   */
  async rotateCredential(
    environmentId: string,
    plaintextSecret: string,
  ): Promise<DatabaseCredential> {
    if (!this.config.controlPlaneDriver) {
      throw new Error('Control-plane driver required for credential rotation.');
    }

    const nowIso = new Date().toISOString();
    const newCredentialId = randomUUID();

    const credential: DatabaseCredential = {
      id: newCredentialId,
      environmentId,
      secretCiphertext: await Promise.resolve(this.encryptor.encrypt(plaintextSecret)),
      encryptionKeyId: this.encryptor.keyId,
      authorization: 'full_access',
      status: 'active',
      createdAt: nowIso,
    };

    // Find existing active credential(s) and revoke them.
    const existing = (await this.config.controlPlaneDriver.find('database_credential', {
      where: { environment_id: environmentId, status: 'active' },
    } as any)) as Array<{ id: string }>;

    for (const row of existing ?? []) {
      await this.config.controlPlaneDriver.update('database_credential', row.id, {
        status: 'revoked',
        revoked_at: nowIso,
        updated_at: nowIso,
      });
    }

    await this.config.controlPlaneDriver.create('database_credential', {
      id: credential.id,
      environment_id: credential.environmentId,
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
   * Register/replace a physical-DB adapter at runtime (useful for tests
   * and for plugins that ship their own driver).
   */
  registerAdapter(adapter: EnvironmentDatabaseAdapter): void {
    this.adapters.set(adapter.driver, adapter);
  }

  private resolveAdapter(driver: DatabaseDriver): EnvironmentDatabaseAdapter | undefined {
    return this.adapters.get(driver);
  }

  private async findDefaultEnvironment(organizationId: string): Promise<{ id: string } | null> {
    if (!this.config.controlPlaneDriver) return null;
    try {
      const rows = (await this.config.controlPlaneDriver.find('environment', {
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
 *
 * - `TURSO_ORG_NAME` + `TURSO_API_TOKEN` present → `TursoEnvironmentDatabaseAdapter`
 *   (provisions real cloud databases via the Turso Platform API).
 * - Otherwise → `LocalSQLiteEnvironmentDatabaseAdapter`
 *   (creates one `.db` file per environment under `.objectstack/data/environments/`).
 */
export function createDefaultEnvironmentAdapters(
  env: Record<string, string | undefined> = process.env,
): EnvironmentDatabaseAdapter[] {
  const orgName = env.TURSO_ORG_NAME;
  const apiToken = env.TURSO_API_TOKEN;

  if (orgName && apiToken) {
    return [new TursoEnvironmentDatabaseAdapter({ organization: orgName, apiToken })];
  }

  return [new LocalSQLiteEnvironmentDatabaseAdapter()];
}

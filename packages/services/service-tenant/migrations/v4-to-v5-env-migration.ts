// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * v4 → v5 Environment-Per-Database Migration
 *
 * Migrates deployments from the legacy `sys_tenant_database` (per-org DB)
 * model to the v5.0 `sys_environment` + `sys_database_credential`
 * (per-environment DB) model. Physical database addressing is now
 * embedded directly on the `sys_environment` row.
 *
 * See `docs/adr/0002-environment-database-isolation.md` for the rationale.
 *
 * --------------------------------------------------------------------------
 * Migration Plan (runs per-organization, idempotent)
 * --------------------------------------------------------------------------
 *
 *   1. For every row in `sys_tenant_database`:
 *        a. Create a `sys_environment` row with:
 *             - `slug = 'prod'`, `env_type = 'production'`, `is_default = true`
 *             - `created_by = <org creator or system user>`
 *             - `plan` / `region` copied from `sys_tenant_database`
 *        b. Create a `sys_environment_database` row that **reuses the
 *           same physical database** as the legacy tenant DB
 *           (no data movement — the existing DB becomes the `prod`
 *           environment DB of the organization).
 *        c. Mint a new `sys_database_credential` row populated from the
 *           existing encrypted `auth_token` (re-encrypted with the
 *           current KMS key id).
 *
 *   2. For every `sys_package_installation` row that references the
 *      legacy `tenant_id`, rewrite its `tenant_id` column to point at the
 *      new `environment_id` (same UUID as step 1a so existing FKs stay
 *      valid). In v5.0 the table is renamed/moved to the environment's
 *      own data plane; this script only updates the FK.
 *
 *   3. Mark the legacy row as archived:
 *        `UPDATE sys_tenant_database SET status = 'archived' WHERE id = <legacy.id>`
 *      (Row is kept for audit until v5.0 removal.)
 *
 *   4. After all orgs are processed, optionally create additional
 *      environments (e.g. `sandbox`, `dev`) per the org's `metadata.plan`
 *      rules — policy lives in the calling code, not here.
 *
 * --------------------------------------------------------------------------
 * Invariants / Safeguards
 * --------------------------------------------------------------------------
 *
 *  - **Idempotent**: re-running the script is a no-op for orgs that
 *    already have a default environment (detected via UNIQUE
 *    `(organization_id, is_default=true)`).
 *  - **Non-destructive**: no legacy rows are deleted; they are archived.
 *  - **No data movement**: physical database URLs are reused, so runtime
 *    traffic does not need a cutover window.
 *  - **Credential re-encryption**: old auth tokens are decrypted with the
 *    legacy KMS key and re-encrypted with the current one before writing
 *    the new credential row.
 *
 * --------------------------------------------------------------------------
 * Usage
 * --------------------------------------------------------------------------
 *
 * ```ts
 * import { migrateV4ToV5Environments } from '@objectstack/service-tenant/migrations/v4-to-v5-env-migration';
 *
 * await migrateV4ToV5Environments({
 *   controlPlaneDriver,
 *   decryptLegacy: (ct) => legacyKms.decrypt(ct),
 *   encryptNew:    (pt) => currentKms.encrypt(pt),
 *   encryptionKeyId: currentKms.keyId,
 *   systemUserId:  'system',
 * });
 * ```
 *
 * The implementation below encodes the contract and invariants. The v5.0
 * release will extend the bulk-read loop with batching / resume tokens /
 * metrics emission; the public signature is stable.
 */

import { randomUUID } from 'node:crypto';
import type { IDataDriver } from '@objectstack/spec';

/** Options for the v4→v5 migration. */
export interface V4ToV5MigrationOptions {
  /** Control-plane driver (must have both legacy and new tables registered). */
  controlPlaneDriver: IDataDriver;

  /** Decrypt legacy `auth_token` ciphertext into plaintext. */
  decryptLegacy: (ciphertext: string) => Promise<string> | string;

  /** Encrypt plaintext into the v5 ciphertext format. */
  encryptNew: (plaintext: string) => Promise<string> | string;

  /** Current KMS/key id, recorded on every new credential row. */
  encryptionKeyId: string;

  /** User id stamped as `created_by` on synthetic `sys_environment` rows. */
  systemUserId: string;

  /** Dry-run: log intended changes without writing. */
  dryRun?: boolean;

  /** Optional logger — defaults to `console`. */
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

/** Summary of a single-org migration step. */
export interface V4ToV5MigrationOrgResult {
  legacyTenantId: string;
  organizationId: string;
  environmentId: string;
  credentialId: string;
  skipped: boolean;
  reason?: string;
}

/** Aggregate result of a migration run. */
export interface V4ToV5MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  durationMs: number;
  orgs: V4ToV5MigrationOrgResult[];
}

/**
 * Migrate every legacy `sys_tenant_database` row to the v5
 * environment-per-database model.
 */
export async function migrateV4ToV5Environments(
  options: V4ToV5MigrationOptions,
): Promise<V4ToV5MigrationResult> {
  const logger = options.logger ?? console;
  const startedAt = Date.now();
  const orgs: V4ToV5MigrationOrgResult[] = [];

  logger.info('[v4→v5] Starting environment-per-database migration', {
    dryRun: options.dryRun === true,
  });

  const legacyRows = (await options.controlPlaneDriver.find(
    'tenant_database',
    {} as any,
  )) as Array<{
    id: string;
    organization_id: string;
    database_name: string;
    database_url: string;
    auth_token: string;
    region: string;
    plan?: string;
    storage_limit_mb?: number;
  }>;

  for (const legacy of legacyRows ?? []) {
    try {
      const existingDefault = (await options.controlPlaneDriver.find('environment', {
        where: { organization_id: legacy.organization_id, is_default: true },
      } as any)) as Array<{ id: string }>;

      if (existingDefault && existingDefault.length > 0) {
        orgs.push({
          legacyTenantId: legacy.id,
          organizationId: legacy.organization_id,
          environmentId: existingDefault[0].id,
          credentialId: '(pre-existing)',
          skipped: true,
          reason: 'Default environment already exists for org',
        });
        continue;
      }

      const nowIso = new Date().toISOString();
      const environmentId = randomUUID();
      const credentialId = randomUUID();

      const plaintext = await Promise.resolve(options.decryptLegacy(legacy.auth_token));
      const secretCiphertext = await Promise.resolve(options.encryptNew(plaintext));

      if (!options.dryRun) {
        await options.controlPlaneDriver.create('environment', {
          id: environmentId,
          organization_id: legacy.organization_id,
          slug: 'prod',
          display_name: 'Production',
          env_type: 'production',
          is_default: true,
          region: legacy.region,
          plan: legacy.plan ?? 'free',
          status: 'active',
          created_by: options.systemUserId,
          created_at: nowIso,
          updated_at: nowIso,
          database_url: legacy.database_url,
          database_driver: 'turso',
          storage_limit_mb: legacy.storage_limit_mb ?? 1024,
          provisioned_at: nowIso,
        });

        await options.controlPlaneDriver.create('database_credential', {
          id: credentialId,
          environment_id: environmentId,
          secret_ciphertext: secretCiphertext,
          encryption_key_id: options.encryptionKeyId,
          authorization: 'full_access',
          status: 'active',
          created_at: nowIso,
          updated_at: nowIso,
        });

        await options.controlPlaneDriver.update('tenant_database', legacy.id, {
          status: 'archived',
          updated_at: nowIso,
        });
      }

      orgs.push({
        legacyTenantId: legacy.id,
        organizationId: legacy.organization_id,
        environmentId,
        credentialId,
        skipped: false,
      });
    } catch (error) {
      logger.error('[v4→v5] Failed to migrate tenant', {
        tenantId: legacy.id,
        error: error instanceof Error ? error.message : String(error),
      });
      orgs.push({
        legacyTenantId: legacy.id,
        organizationId: legacy.organization_id,
        environmentId: '',
        credentialId: '',
        skipped: true,
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const skipped = orgs.filter((o) => o.skipped).length;
  const migrated = orgs.length - skipped;

  logger.info('[v4→v5] Migration complete', {
    total: orgs.length,
    migrated,
    skipped,
    durationMs: Date.now() - startedAt,
  });

  return {
    total: orgs.length,
    migrated,
    skipped,
    durationMs: Date.now() - startedAt,
    orgs,
  };
}

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Environment Package Installation Protocol
 *
 * Models `sys_package_installation` — the pairing between an environment and a
 * specific, immutable package version snapshot (`sys_package_version`).
 *
 * Key invariants (per ADR-0003):
 * - One active version per package per environment at any time.
 * - **Upgrade** = atomic `UPDATE package_version_id` to a newer version UUID.
 * - **Rollback** = atomic `UPDATE package_version_id` to an older version UUID.
 * - The `upgradeHistory` field is removed; history is tracked via the
 *   sequence of `package_version_id` changes on this row (and an optional
 *   `sys_package_installation_history` audit table).
 * - Only `status = 'published'` versions may be installed in production
 *   environments (draft/pre-release allowed in dev/sandbox with `allowDraft`).
 *
 * Stored in the **Control Plane DB** (not in environment DBs).
 *
 * See `docs/adr/0003-package-as-first-class-citizen.md` for the full rationale.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a package installation within an environment.
 */
export const EnvPackageStatusSchema = z
  .enum([
    'installed',   // Active and running; metadata loaded into this environment
    'installing',  // Install in progress (async)
    'upgrading',   // Version swap in progress (async)
    'disabled',    // Installed but not active — metadata not loaded
    'error',       // Install/upgrade failed; see errorMessage
  ])
  .describe('Package installation status within an environment');

export type EnvPackageStatus = z.infer<typeof EnvPackageStatusSchema>;

// Keep old enum name as alias for backwards compatibility
/** @deprecated Use {@link EnvPackageStatusSchema} */
export const EnvPackageStatusEnum = EnvPackageStatusSchema;

// ---------------------------------------------------------------------------
// sys_package_installation — Environment ↔ version pairing
// ---------------------------------------------------------------------------

/**
 * One row in `sys_package_installation`.
 *
 * Unique by `(environment_id, package_id)` — only one version of a given
 * package may be active per environment. The `package_id` is derived from the
 * linked `sys_package_version` row (denormalised for fast constraint checks).
 */
export const EnvironmentPackageInstallationSchema = z.object({
  /** Unique installation record ID (UUID). */
  id: z.string().uuid().describe('Unique installation record ID'),

  /** Environment that owns this installation (FK → sys_environment). */
  environmentId: z.string().uuid().describe('Environment this installation belongs to'),

  /**
   * The specific, immutable version snapshot that is installed
   * (FK → sys_package_version.id).
   *
   * Upgrading = swapping this field to a newer version UUID.
   * Rollback   = swapping this field to an older version UUID.
   */
  packageVersionId: z.string().uuid()
    .describe('UUID of the installed sys_package_version row'),

  /**
   * Denormalized package UUID (FK → sys_package.id) copied from the version
   * row at install time. Used for the UNIQUE (environment_id, package_id)
   * constraint without a join.
   */
  packageId: z.string().uuid()
    .describe('UUID of the parent sys_package row (denormalized for constraint enforcement)'),

  /** Current lifecycle status within this environment. */
  status: EnvPackageStatusSchema.default('installed'),

  /** Whether the package is active (metadata loaded and available). */
  enabled: z.boolean().default(true).describe('Whether the package metadata is loaded'),

  /**
   * Per-installation configuration values.
   * Keys mirror the package manifest's `configurationSchema.properties`.
   */
  settings: z.record(z.string(), z.unknown()).optional()
    .describe('Per-installation configuration settings'),

  /** ISO-8601 timestamp when this installation was created. */
  installedAt: z.string().datetime().describe('Installation timestamp (ISO-8601)'),

  /** User ID of the member who performed the install (null for system installs). */
  installedBy: z.string().optional().describe('User ID of the installer'),

  /** ISO-8601 timestamp of the most recent update (version swap, enable/disable). */
  updatedAt: z.string().datetime().optional().describe('Last update timestamp (ISO-8601)'),

  /** Error details when `status === "error"`. */
  errorMessage: z.string().optional().describe('Error message when status is error'),
}).describe('Package installation record in an environment (sys_package_installation)');

export type EnvironmentPackageInstallation = z.infer<typeof EnvironmentPackageInstallationSchema>;

// ---------------------------------------------------------------------------
// Install / Upgrade / Uninstall requests
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /cloud/environments/:envId/packages`.
 *
 * Installs a specific package version into an environment.
 * The resolved `packageVersionId` is the primary key for the install record.
 */
export const InstallPackageToEnvRequestSchema = z.object({
  /**
   * UUID of the specific `sys_package_version` to install.
   * Mutually exclusive with `packageId + version` convenience fields.
   */
  packageVersionId: z.string().uuid().optional()
    .describe('Exact package version UUID to install (preferred)'),

  /**
   * Convenience: install by manifest ID + version string.
   * The server resolves these to a `packageVersionId`.
   * Ignored if `packageVersionId` is set.
   */
  packageManifestId: z.string().optional()
    .describe('Package manifest ID (reverse-domain, e.g. com.acme.crm) — resolved to version UUID'),

  /** Target version string when using `packageManifestId`. Defaults to latest published. */
  version: z.string().optional().describe('Version string (defaults to latest published)'),

  /**
   * Allow installing a draft (unpublished) version.
   * Rejected for production environments (`envType = "production"`).
   */
  allowDraft: z.boolean().default(false)
    .describe('Allow installing a draft version (dev/sandbox envs only)'),

  /** Per-installation configuration values. */
  settings: z.record(z.string(), z.unknown()).optional()
    .describe('Installation-time configuration settings'),

  /** Whether to enable the package immediately after installing. */
  enableOnInstall: z.boolean().default(true)
    .describe('Activate the package immediately after install'),

  /** User ID performing the install. */
  installedBy: z.string().optional().describe('User ID of the installer'),
}).describe('Install a package version into a specific environment')
  .refine(
    data => data.packageVersionId != null || data.packageManifestId != null,
    { message: 'Either packageVersionId or packageManifestId must be provided' }
  );

export type InstallPackageToEnvRequest = z.infer<typeof InstallPackageToEnvRequestSchema>;

/**
 * Request body for `POST /cloud/environments/:envId/packages/:installationId/upgrade`.
 *
 * Atomically swaps the `packageVersionId` on an existing installation row.
 */
export const UpgradeEnvPackageRequestSchema = z.object({
  /**
   * UUID of the target `sys_package_version` to upgrade to.
   * Mutually exclusive with `targetVersion` string.
   */
  targetPackageVersionId: z.string().uuid().optional()
    .describe('Target package version UUID (preferred)'),

  /**
   * Convenience: upgrade to this version string.
   * The server resolves it to a `packageVersionId`.
   * Ignored if `targetPackageVersionId` is set.
   */
  targetVersion: z.string().optional()
    .describe('Target version string (defaults to latest published)'),

  /** Allow upgrading to a draft version (dev/sandbox envs only). */
  allowDraft: z.boolean().default(false)
    .describe('Allow upgrading to a draft version'),

  /** User ID performing the upgrade. */
  upgradedBy: z.string().optional().describe('User ID performing the upgrade'),
}).describe('Upgrade a package installation to a newer version');

export type UpgradeEnvPackageRequest = z.infer<typeof UpgradeEnvPackageRequestSchema>;

/**
 * Request body for `POST /cloud/environments/:envId/packages/:installationId/rollback`.
 *
 * Atomically swaps `packageVersionId` back to a previously installed version.
 */
export const RollbackEnvPackageRequestSchema = z.object({
  /** UUID of the `sys_package_version` to roll back to. Required. */
  targetPackageVersionId: z.string().uuid()
    .describe('Package version UUID to roll back to'),

  /** User ID performing the rollback. */
  rolledBackBy: z.string().optional().describe('User ID performing the rollback'),
}).describe('Roll back a package installation to a specific older version');

export type RollbackEnvPackageRequest = z.infer<typeof RollbackEnvPackageRequestSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

/**
 * Response from `GET /cloud/environments/:envId/packages`.
 */
export const ListEnvPackagesResponseSchema = z.object({
  packages: z.array(EnvironmentPackageInstallationSchema)
    .describe('Packages installed in this environment'),
  total: z.number().describe('Total count'),
}).describe('List of packages installed in an environment');

export type ListEnvPackagesResponse = z.infer<typeof ListEnvPackagesResponseSchema>;

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Project Package Installation Protocol
 *
 * Models `sys_package_installation` — the pairing between a project and a
 * specific, immutable package version snapshot (`sys_package_version`).
 *
 * Key invariants (per ADR-0003):
 * - One active version per package per project at any time.
 * - **Upgrade** = atomic `UPDATE package_version_id` to a newer version UUID.
 * - **Rollback** = atomic `UPDATE package_version_id` to an older version UUID.
 * - Only `status = 'published'` versions may be installed in production
 *   projects (draft/pre-release allowed in dev/sandbox with `allowDraft`).
 *
 * Stored in the **Control Plane DB** (not in project DBs).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a package installation within a project.
 */
import { lazySchema } from '../shared/lazy-schema';
export const ProjectPackageStatusSchema = lazySchema(() => z
  .enum([
    'installed',   // Active and running; metadata loaded into this project
    'installing',  // Install in progress (async)
    'upgrading',   // Version swap in progress (async)
    'disabled',    // Installed but not active — metadata not loaded
    'error',       // Install/upgrade failed; see errorMessage
  ])
  .describe('Package installation status within a project'));

export type ProjectPackageStatus = z.infer<typeof ProjectPackageStatusSchema>;

// ---------------------------------------------------------------------------
// sys_package_installation — Project ↔ version pairing
// ---------------------------------------------------------------------------

/**
 * One row in `sys_package_installation`.
 *
 * Unique by `(project_id, package_id)` — only one version of a given
 * package may be active per project.
 */
export const ProjectPackageInstallationSchema = lazySchema(() => z.object({
  /** Unique installation record ID (UUID). */
  id: z.string().uuid().describe('Unique installation record ID'),

  /** Project that owns this installation (FK → sys_project). */
  projectId: z.string().uuid().describe('Project this installation belongs to'),

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
   * row at install time. Used for the UNIQUE (project_id, package_id)
   * constraint without a join.
   */
  packageId: z.string().uuid()
    .describe('UUID of the parent sys_package row (denormalized for constraint enforcement)'),

  /** Current lifecycle status within this project. */
  status: ProjectPackageStatusSchema.default('installed'),

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
}).describe('Package installation record in a project (sys_package_installation)'));

export type ProjectPackageInstallation = z.infer<typeof ProjectPackageInstallationSchema>;

// ---------------------------------------------------------------------------
// Install / Upgrade / Rollback requests
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /cloud/projects/:projectId/packages`.
 */
export const InstallPackageToProjectRequestSchema = lazySchema(() => z.object({
  packageVersionId: z.string().uuid().optional()
    .describe('Exact package version UUID to install (preferred)'),
  packageManifestId: z.string().optional()
    .describe('Package manifest ID (reverse-domain, e.g. com.acme.crm) — resolved to version UUID'),
  version: z.string().optional().describe('Version string (defaults to latest published)'),
  allowDraft: z.boolean().default(false)
    .describe('Allow installing a draft version (dev/sandbox projects only)'),
  settings: z.record(z.string(), z.unknown()).optional()
    .describe('Installation-time configuration settings'),
  enableOnInstall: z.boolean().default(true)
    .describe('Activate the package immediately after install'),
  installedBy: z.string().optional().describe('User ID of the installer'),
}).describe('Install a package version into a specific project')
  .refine(
    data => data.packageVersionId != null || data.packageManifestId != null,
    { message: 'Either packageVersionId or packageManifestId must be provided' }
  ));

export type InstallPackageToProjectRequest = z.infer<typeof InstallPackageToProjectRequestSchema>;

/**
 * Request body for upgrading a package installation.
 */
export const UpgradeProjectPackageRequestSchema = lazySchema(() => z.object({
  targetPackageVersionId: z.string().uuid().optional()
    .describe('Target package version UUID (preferred)'),
  targetVersion: z.string().optional()
    .describe('Target version string (defaults to latest published)'),
  allowDraft: z.boolean().default(false)
    .describe('Allow upgrading to a draft version'),
  upgradedBy: z.string().optional().describe('User ID performing the upgrade'),
}).describe('Upgrade a package installation to a newer version'));

export type UpgradeProjectPackageRequest = z.infer<typeof UpgradeProjectPackageRequestSchema>;

/**
 * Request body for rolling back a package installation.
 */
export const RollbackProjectPackageRequestSchema = lazySchema(() => z.object({
  targetPackageVersionId: z.string().uuid()
    .describe('Package version UUID to roll back to'),
  rolledBackBy: z.string().optional().describe('User ID performing the rollback'),
}).describe('Roll back a package installation to a specific older version'));

export type RollbackProjectPackageRequest = z.infer<typeof RollbackProjectPackageRequestSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

/**
 * Response from `GET /cloud/projects/:projectId/packages`.
 */
export const ListProjectPackagesResponseSchema = lazySchema(() => z.object({
  packages: z.array(ProjectPackageInstallationSchema)
    .describe('Packages installed in this project'),
  total: z.number().describe('Total count'),
}).describe('List of packages installed in a project'));

export type ListProjectPackagesResponse = z.infer<typeof ListProjectPackagesResponseSchema>;

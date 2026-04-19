// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * # Environment Package Installation Protocol
 *
 * Models the per-environment package install record stored in each
 * environment's own database (`sys_package_installation` table).
 *
 * ## Architecture (Power Apps alignment)
 * - **Platform control-plane DB**: Users, Orgs, Envs, EnvMembers — never per-env.
 * - **Per-env DB**: This schema (install record) + app metadata + business data.
 * - **Runtime layer**: Global manifest registry; `scope = 'platform'` packages
 *   are provided by the runtime — not installed per-env.
 *
 * Only packages with `manifest.scope === 'environment'` can be installed
 * through this protocol.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a package inside an environment.
 */
export const EnvPackageStatusEnum = z.enum([
  'installed',    // Active and running
  'installing',   // Install in progress
  'upgrading',    // Upgrade in progress
  'disabled',     // Installed but not active (metadata not loaded)
  'error',        // Install/upgrade failed; see errorMessage
]).describe('Package installation status within an environment');
export type EnvPackageStatus = z.infer<typeof EnvPackageStatusEnum>;

// ─── Core schema ─────────────────────────────────────────────────────────────

/**
 * One row in `sys_package_installation` — a package installed in a specific env.
 */
export const EnvironmentPackageInstallationSchema = z.object({
  /** Unique row identifier (UUID). */
  id: z.string().uuid().describe('Unique installation record ID'),

  /** Foreign key to the environment that owns this installation. */
  environmentId: z.string().describe('Environment this installation belongs to'),

  /**
   * The manifest `id` of the installed package (reverse-domain style,
   * e.g. "com.acme.crm"). References the global runtime package registry.
   */
  packageId: z.string().describe('Package manifest ID (reverse-domain identifier)'),

  /** The installed semantic version string (e.g. "1.2.0"). */
  version: z.string().describe('Installed package version'),

  /** Current lifecycle status within this environment. */
  status: EnvPackageStatusEnum.default('installed'),

  /** Whether the package is active (metadata loaded and available). */
  enabled: z.boolean().default(true).describe('Whether the package is enabled'),

  /** ISO 8601 timestamp when this installation was created. */
  installedAt: z.coerce.date().describe('Installation timestamp'),

  /** User ID of the member who performed the install (optional for system installs). */
  installedBy: z.string().optional().describe('User ID of the installer'),

  /** ISO 8601 timestamp of the most recent update (upgrade, enable/disable). */
  updatedAt: z.coerce.date().optional().describe('Last update timestamp'),

  /** Error details when `status === "error"`. */
  errorMessage: z.string().optional().describe('Error message when status is error'),

  /**
   * User-provided configuration overrides for this installation.
   * Keys mirror the package manifest's `configuration.properties`.
   */
  settings: z.record(z.string(), z.unknown()).optional()
    .describe('Per-installation configuration settings'),

  /**
   * Ordered record of version upgrades applied to this installation.
   */
  upgradeHistory: z.array(z.object({
    /** Version before the upgrade. */
    fromVersion: z.string().describe('Version before upgrade'),
    /** Version after the upgrade. */
    toVersion: z.string().describe('Version after upgrade'),
    /** Timestamp of the upgrade operation. */
    upgradedAt: z.coerce.date().describe('Upgrade timestamp'),
    /** User who triggered the upgrade (optional for automated upgrades). */
    upgradedBy: z.string().optional().describe('User ID of the upgrader'),
    /** Final outcome. */
    status: z.enum(['success', 'failed', 'rolled_back']).describe('Upgrade outcome'),
  })).default([]).describe('Version upgrade history for this installation'),
}).describe('Package installation record in an environment (sys_package_installation)');

export type EnvironmentPackageInstallation = z.infer<typeof EnvironmentPackageInstallationSchema>;

// ─── Request / Response schemas ──────────────────────────────────────────────

/**
 * Request body for `POST /cloud/environments/:envId/packages`.
 */
export const InstallPackageToEnvRequestSchema = z.object({
  /**
   * ID of the package to install (from the global manifest registry).
   * Must reference a package with `manifest.scope === 'environment'`.
   */
  packageId: z.string().describe('Package ID to install'),

  /**
   * Specific version to install. Omit to install the latest available version.
   */
  version: z.string().optional().describe('Target version (defaults to latest)'),

  /** Per-installation configuration values. */
  settings: z.record(z.string(), z.unknown()).optional()
    .describe('Installation-time configuration settings'),

  /** Whether to enable the package immediately after installing (default true). */
  enableOnInstall: z.boolean().default(true)
    .describe('Activate the package immediately after install'),
}).describe('Install a package into a specific environment');

export type InstallPackageToEnvRequest = z.infer<typeof InstallPackageToEnvRequestSchema>;

/**
 * Request body for `POST /cloud/environments/:envId/packages/:pkgId/upgrade`.
 */
export const UpgradeEnvPackageRequestSchema = z.object({
  /** Target version to upgrade to. Omit to upgrade to the latest. */
  targetVersion: z.string().optional().describe('Target version (defaults to latest)'),
}).describe('Upgrade a package installation to a newer version');

export type UpgradeEnvPackageRequest = z.infer<typeof UpgradeEnvPackageRequestSchema>;

/**
 * List installations response.
 */
export const ListEnvPackagesResponseSchema = z.object({
  packages: z.array(EnvironmentPackageInstallationSchema)
    .describe('Packages installed in this environment'),
  total: z.number().describe('Total count'),
}).describe('List of packages installed in an environment');

export type ListEnvPackagesResponse = z.infer<typeof ListEnvPackagesResponseSchema>;

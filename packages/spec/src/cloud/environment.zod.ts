// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { TenantPlanSchema } from './tenant.zod';

/**
 * Environment-Per-Database Isolation Protocol
 *
 * Each **environment** (dev/test/prod/sandbox) owns a physically isolated
 * database. The Control Plane stores all environment metadata; environment
 * DBs contain only business data rows.
 *
 * Split of concerns:
 * - **Control Plane**: `sys_environment` (includes physical DB addressing),
 *   `sys_package_installation` (with env_id), `sys_metadata` (with env_id),
 *   `sys_database_credential`, `sys_environment_member`.
 * - **Data Plane**: each environment DB contains only business objects
 *   (account, task, …). No system tables, no `environment_id` columns.
 *
 * See `docs/adr/0002-environment-database-isolation.md` for the full
 * rationale.
 */

// ---------------------------------------------------------------------------
// Environment registry
// ---------------------------------------------------------------------------

/**
 * Environment type — canonical buckets per industry convention
 * (Salesforce, Power Platform, ServiceNow all use this taxonomy).
 */
export const EnvironmentTypeSchema = z
  .enum(['production', 'sandbox', 'development', 'test', 'staging', 'preview', 'trial'])
  .describe('Environment type (prod/sandbox/dev/test/…)');

export type EnvironmentType = z.infer<typeof EnvironmentTypeSchema>;

/**
 * Environment lifecycle status
 */
export const EnvironmentStatusSchema = z
  .enum(['provisioning', 'active', 'suspended', 'archived', 'failed', 'migrating'])
  .describe('Environment lifecycle status');

export type EnvironmentStatus = z.infer<typeof EnvironmentStatusSchema>;

/**
 * Backend driver registry — keys used by the data-plane driver factory.
 * Kept open-ended (`z.string()`) so third-party drivers can register new
 * backends without a core release.
 */
export const DatabaseDriverSchema = z
  .string()
  .min(1)
  .describe('Data-plane driver key (e.g. `turso`, `libsql`, `sqlite`, `postgres`)');

export type DatabaseDriver = z.infer<typeof DatabaseDriverSchema>;

/**
 * Environment — one logical runtime of an organization's data.
 *
 * An organization may own many environments (e.g. `prod`, `staging`,
 * `dev-alice`, `sandbox-demo`). Physical database connection info is
 * stored directly on this row so a single lookup gives both logical
 * and physical addressing. Environments are addressable by
 * `(organizationId, slug)`.
 */
export const EnvironmentSchema = z.object({
  /** UUID of the environment (stable, never reused). */
  id: z.string().uuid().describe('UUID of the environment (stable, never reused)'),

  /** Organization that owns this environment. */
  organizationId: z.string().describe('Organization that owns this environment'),

  /** Human-friendly slug, unique within the organization (e.g. `prod`, `qa-2`). */
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .describe('Slug unique per organization (snake_case/kebab-case allowed)'),

  /** Display name shown in Studio and APIs. */
  displayName: z.string().describe('Display name shown in Studio and APIs'),

  /** Environment classification used for routing, quotas, and RBAC defaults. */
  envType: EnvironmentTypeSchema.describe('Environment classification'),

  /** Whether this is the organization's **default** environment. Exactly one per org. */
  isDefault: z.boolean().default(false).describe('Whether this is the default environment for the organization'),

  /** Region where the physical database is deployed. */
  region: z.string().optional().describe('Region where the physical database is deployed (e.g. us-east-1)'),

  /** Plan tier applied to this environment for quota/billing enforcement. */
  plan: TenantPlanSchema.default('free').describe('Plan tier for this environment'),

  /** Environment lifecycle status. */
  status: EnvironmentStatusSchema.default('provisioning').describe('Environment lifecycle status'),

  /** User ID that created the environment. */
  createdBy: z.string().describe('User ID that created the environment'),

  /** Creation timestamp (ISO-8601). */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp (ISO-8601). */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),

  // ── Physical database addressing (merged from sys_environment_database) ──

  /** Full connection URL (e.g. `libsql://env-<uuid>.turso.io`, `postgres://…`). Set after provisioning. */
  databaseUrl: z.string().url().optional().describe('Full connection URL for the environment database'),

  /** Data-plane driver key. */
  databaseDriver: DatabaseDriverSchema.optional().describe('Data-plane driver key (turso, libsql, sqlite, memory, postgres)'),

  /** Storage quota in megabytes. */
  storageLimitMb: z.number().int().positive().optional().describe('Storage quota in megabytes'),

  /** When the physical database was provisioned. */
  provisionedAt: z.string().datetime().optional().describe('Provisioning timestamp (ISO-8601)'),

  /** Free-form metadata (feature flags, tags, …). */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

// ---------------------------------------------------------------------------
// Driver registry
// ---------------------------------------------------------------------------

/**
 * @deprecated Physical database fields are now embedded directly on
 * {@link EnvironmentSchema} (`databaseUrl`, `databaseDriver`, `storageLimitMb`,
 * `provisionedAt`). This schema is retained for migration compatibility only
 * and will be removed in a future release.
 */
export const EnvironmentDatabaseSchema = z.object({
  /** UUID of the mapping. */
  id: z.string().uuid().describe('UUID of the environment-database mapping'),

  /** Environment this database backs (UNIQUE). */
  environmentId: z.string().uuid().describe('Environment this database backs (UNIQUE)'),

  /** Physical database name (e.g. `env-<uuid>`). Immutable once provisioned. */
  databaseName: z.string().describe('Physical database name (immutable)'),

  /** Full connection URL (e.g. `libsql://env-<uuid>.turso.io`, `postgres://…`). */
  databaseUrl: z.string().url().describe('Full connection URL'),

  /** Data-plane driver key. */
  driver: DatabaseDriverSchema,

  /** Region of the physical database (used for latency-aware routing). */
  region: z.string().describe('Region of the physical database'),

  /** Storage quota in megabytes. */
  storageLimitMb: z.number().int().positive().describe('Storage quota in megabytes'),

  /** When the physical database was provisioned. */
  provisionedAt: z.string().datetime().describe('Provisioning timestamp (ISO-8601)'),

  /** Last successful access (populated by the router for cache invalidation). */
  lastAccessedAt: z.string().datetime().optional().describe('Last successful access timestamp'),

  /** Free-form metadata (replica topology, group, backup policy, …). */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),
});

export type EnvironmentDatabase = z.infer<typeof EnvironmentDatabaseSchema>;

// ---------------------------------------------------------------------------
// Database credentials (rotatable)
// ---------------------------------------------------------------------------

/**
 * Credential lifecycle status — used during rotation:
 * the previous credential stays `active` until the new one has been
 * propagated to all runtimes, then flips to `revoked`.
 */
export const DatabaseCredentialStatusSchema = z
  .enum(['active', 'rotating', 'revoked'])
  .describe('Credential lifecycle status');

export type DatabaseCredentialStatus = z.infer<typeof DatabaseCredentialStatusSchema>;

/**
 * Encrypted credential for an environment's database.
 *
 * Stored as a separate row (not embedded in {@link EnvironmentDatabaseSchema})
 * so that secrets can be rotated, revoked, and audited independently of the
 * addressing record. Multiple credentials can exist per database during
 * rotation windows.
 */
export const DatabaseCredentialSchema = z.object({
  /** UUID of the credential. */
  id: z.string().uuid().describe('UUID of the credential'),

  /** Environment this credential authorizes. */
  environmentId: z.string().uuid().describe('Environment this credential authorizes'),

  /** Encrypted auth token or secret (ciphertext). */
  secretCiphertext: z.string().describe('Encrypted auth token or secret (ciphertext)'),

  /** KMS/encryption key ID that produced `secretCiphertext`. */
  encryptionKeyId: z.string().describe('Encryption key ID used to encrypt the secret'),

  /** Authorization scope (e.g. `full_access`, `read_only`). */
  authorization: z
    .enum(['full_access', 'read_only'])
    .default('full_access')
    .describe('Authorization scope for this credential'),

  /** Credential lifecycle status. */
  status: DatabaseCredentialStatusSchema.default('active').describe('Credential lifecycle status'),

  /** Credential creation timestamp. */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Optional expiry — after this timestamp the credential must be rotated. */
  expiresAt: z.string().datetime().optional().describe('Optional expiry timestamp'),

  /** Timestamp when the credential was revoked (null while active). */
  revokedAt: z.string().datetime().optional().describe('Revocation timestamp (if revoked)'),
});

export type DatabaseCredential = z.infer<typeof DatabaseCredentialSchema>;

// ---------------------------------------------------------------------------
// Environment-scoped RBAC
// ---------------------------------------------------------------------------

/**
 * Per-environment role assigned to a user/service principal.
 * Scoped narrowly to environment boundaries so that prod can have a
 * different cast of admins than dev.
 */
export const EnvironmentRoleSchema = z
  .enum(['owner', 'admin', 'maker', 'reader', 'guest'])
  .describe('Per-environment role');

export type EnvironmentRole = z.infer<typeof EnvironmentRoleSchema>;

/**
 * Environment membership — grants a user access to a specific environment.
 *
 * Unique by `(environmentId, userId)`. A user may be a member of multiple
 * environments within the same organization with different roles.
 */
export const EnvironmentMemberSchema = z.object({
  /** UUID of the membership. */
  id: z.string().uuid().describe('UUID of the membership'),

  /** Environment this membership grants access to. */
  environmentId: z.string().uuid().describe('Environment this membership grants access to'),

  /** User ID (references `user` in the control plane). */
  userId: z.string().describe('User ID'),

  /** Per-environment role. */
  role: EnvironmentRoleSchema.describe('Per-environment role'),

  /** User ID of the member who invited / granted this membership. */
  invitedBy: z.string().describe('User ID that granted this membership'),

  /** Creation timestamp. */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp. */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),
});

export type EnvironmentMember = z.infer<typeof EnvironmentMemberSchema>;

// ---------------------------------------------------------------------------
// Provisioning requests / responses
// ---------------------------------------------------------------------------

/**
 * Request to provision a new environment for an organization.
 *
 * Upstream callers typically invoke this through
 * `EnvironmentProvisioningService.provisionEnvironment()`.
 */
export const ProvisionEnvironmentRequestSchema = z.object({
  organizationId: z.string().describe('Organization that will own the new environment'),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .describe('Slug unique per organization'),
  displayName: z.string().optional().describe('Display name (defaults to slug)'),
  envType: EnvironmentTypeSchema.describe('Environment type'),
  region: z.string().optional().describe('Region preference for the physical DB'),
  driver: DatabaseDriverSchema.optional().describe('Driver key (defaults to provisioning service config)'),
  plan: TenantPlanSchema.optional().describe('Plan tier'),
  storageLimitMb: z.number().int().positive().optional().describe('Storage quota in megabytes'),
  isDefault: z.boolean().optional().describe('Mark as the organization default environment'),
  createdBy: z.string().describe('User ID that initiated the provisioning'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),
});

export type ProvisionEnvironmentRequest = z.infer<typeof ProvisionEnvironmentRequestSchema>;

/**
 * Response of a successful environment provisioning call.
 * The environment record now includes database addressing fields directly.
 */
export const ProvisionEnvironmentResponseSchema = z.object({
  environment: EnvironmentSchema.describe('Provisioned environment (includes database addressing)'),
  credential: DatabaseCredentialSchema.describe('Freshly-minted credential for the environment DB'),
  durationMs: z.number().describe('Total provisioning duration in milliseconds'),
  warnings: z.array(z.string()).optional().describe('Non-fatal warnings emitted during provisioning'),
});

export type ProvisionEnvironmentResponse = z.infer<typeof ProvisionEnvironmentResponseSchema>;

/**
 * Request to bootstrap a brand-new organization — allocates the default
 * environment (and its DB) in one atomic call.
 */
export const ProvisionOrganizationRequestSchema = z.object({
  organizationId: z.string().describe('Organization being bootstrapped'),
  defaultEnvType: EnvironmentTypeSchema.default('production').describe('Env type for the default environment'),
  defaultEnvSlug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .default('prod')
    .describe('Slug for the default environment'),
  region: z.string().optional().describe('Region preference'),
  driver: DatabaseDriverSchema.optional().describe('Driver key'),
  plan: TenantPlanSchema.optional().describe('Plan tier'),
  storageLimitMb: z.number().int().positive().optional().describe('Storage quota in megabytes'),
  createdBy: z.string().describe('User ID that initiated provisioning'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),
});

export type ProvisionOrganizationRequest = z.infer<typeof ProvisionOrganizationRequestSchema>;

/**
 * Response of a successful organization bootstrap.
 */
export const ProvisionOrganizationResponseSchema = z.object({
  defaultEnvironment: ProvisionEnvironmentResponseSchema.describe('Default environment that was created'),
  durationMs: z.number().describe('Total bootstrap duration in milliseconds'),
  warnings: z.array(z.string()).optional().describe('Non-fatal warnings'),
});

export type ProvisionOrganizationResponse = z.infer<typeof ProvisionOrganizationResponseSchema>;

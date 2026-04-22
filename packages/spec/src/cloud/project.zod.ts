// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { TenantPlanSchema } from './tenant.zod';

/**
 * Project-Per-Database Isolation Protocol
 *
 * Each **project** owns a physically isolated database. The Control Plane stores
 * all project metadata; project DBs contain only business data rows.
 *
 * Split of concerns:
 * - **Control Plane**: `sys_project` (includes physical DB addressing),
 *   `sys_package_installation` (with project_id), `sys_metadata` (with project_id),
 *   `sys_project_credential`, `sys_project_member`.
 * - **Data Plane**: each project DB contains only business objects
 *   (account, task, …). No system tables, no `project_id` columns.
 */

// ---------------------------------------------------------------------------
// Project registry
// ---------------------------------------------------------------------------

/**
 * Project type — canonical buckets per industry convention
 * (Salesforce, Power Platform, ServiceNow all use this taxonomy).
 */
export const ProjectTypeSchema = z
  .enum(['production', 'sandbox', 'development', 'test', 'staging', 'preview', 'trial'])
  .describe('Project type (prod/sandbox/dev/test/…)');

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

/**
 * Project lifecycle status
 */
export const ProjectStatusSchema = z
  .enum(['provisioning', 'active', 'suspended', 'archived', 'failed', 'migrating'])
  .describe('Project lifecycle status');

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

/**
 * Backend driver registry — keys used by the data-plane driver factory.
 * Kept open-ended (`z.string()`) so third-party drivers can register new
 * backends without a core release.
 */
export const ProjectDriverSchema = z
  .string()
  .min(1)
  .describe('Data-plane driver key (e.g. `turso`, `libsql`, `sqlite`, `postgres`)');

export type ProjectDriver = z.infer<typeof ProjectDriverSchema>;

/**
 * Project — one logical runtime of an organization's data.
 *
 * An organization may own many projects (e.g. `prod`, `staging`,
 * `dev-alice`, `sandbox-demo`). Physical database connection info is
 * stored directly on this row so a single lookup gives both logical
 * and physical addressing. Projects are addressable by
 * `(organizationId, slug)`.
 */
export const ProjectSchema = z.object({
  /** UUID of the project (stable, never reused). */
  id: z.string().uuid().describe('UUID of the project (stable, never reused)'),

  /** Organization that owns this project. */
  organizationId: z.string().describe('Organization that owns this project'),

  /** Human-friendly slug, unique within the organization (e.g. `prod`, `qa-2`). */
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .describe('Slug unique per organization (snake_case/kebab-case allowed)'),

  /** Display name shown in Studio and APIs. */
  displayName: z.string().describe('Display name shown in Studio and APIs'),

  /** Project classification used for routing, quotas, and RBAC defaults. */
  projectType: ProjectTypeSchema.describe('Project classification'),

  /** Whether this is the organization's **default** project. Exactly one per org. */
  isDefault: z.boolean().default(false).describe('Whether this is the default project for the organization'),

  /** Whether this is a system project (platform infrastructure, not user data). */
  isSystem: z.boolean().default(false).describe('Whether this is a system project (platform infrastructure, not user data)'),

  /** Region where the physical database is deployed. */
  region: z.string().optional().describe('Region where the physical database is deployed (e.g. us-east-1)'),

  /** Plan tier applied to this project for quota/billing enforcement. */
  plan: TenantPlanSchema.default('free').describe('Plan tier for this project'),

  /** Project lifecycle status. */
  status: ProjectStatusSchema.default('provisioning').describe('Project lifecycle status'),

  /** User ID that created the project. */
  createdBy: z.string().describe('User ID that created the project'),

  /** Creation timestamp (ISO-8601). */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp (ISO-8601). */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),

  // ── Physical database addressing ──

  /** Full connection URL (e.g. `libsql://proj-<uuid>.turso.io`, `postgres://…`). Set after provisioning. */
  databaseUrl: z.string().url().optional().describe('Full connection URL for the project database'),

  /** Data-plane driver key. */
  databaseDriver: ProjectDriverSchema.optional().describe('Data-plane driver key (turso, libsql, sqlite, memory, postgres)'),

  /** Storage quota in megabytes. */
  storageLimitMb: z.number().int().positive().optional().describe('Storage quota in megabytes'),

  /** When the physical database was provisioned. */
  provisionedAt: z.string().datetime().optional().describe('Provisioning timestamp (ISO-8601)'),

  /** Free-form metadata (feature flags, tags, …). */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),

  /**
   * Canonical hostname for this project (e.g. acme-dev.objectstack.app or api.acme.com).
   * UNIQUE. Auto-set on creation; can be overridden for custom domains.
   * Used for project resolution via hostname matching.
   */
  hostname: z
    .string()
    .optional()
    .describe('Canonical hostname for this project (e.g. acme-dev.objectstack.app or api.acme.com). UNIQUE. Auto-set on creation; can be overridden for custom domains.'),
});

export type Project = z.infer<typeof ProjectSchema>;

// ---------------------------------------------------------------------------
// Credential (rotatable)
// ---------------------------------------------------------------------------

/**
 * Credential lifecycle status — used during rotation.
 */
export const ProjectCredentialStatusSchema = z
  .enum(['active', 'rotating', 'revoked'])
  .describe('Credential lifecycle status');

export type ProjectCredentialStatus = z.infer<typeof ProjectCredentialStatusSchema>;

/**
 * Encrypted credential for a project's database.
 */
export const ProjectCredentialSchema = z.object({
  /** UUID of the credential. */
  id: z.string().uuid().describe('UUID of the credential'),

  /** Project this credential authorizes. */
  projectId: z.string().uuid().describe('Project this credential authorizes'),

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
  status: ProjectCredentialStatusSchema.default('active').describe('Credential lifecycle status'),

  /** Credential creation timestamp. */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Optional expiry — after this timestamp the credential must be rotated. */
  expiresAt: z.string().datetime().optional().describe('Optional expiry timestamp'),

  /** Timestamp when the credential was revoked (null while active). */
  revokedAt: z.string().datetime().optional().describe('Revocation timestamp (if revoked)'),
});

export type ProjectCredential = z.infer<typeof ProjectCredentialSchema>;

// ---------------------------------------------------------------------------
// Project-scoped RBAC
// ---------------------------------------------------------------------------

/**
 * Per-project role assigned to a user/service principal.
 */
export const ProjectRoleSchema = z
  .enum(['owner', 'admin', 'maker', 'reader', 'guest'])
  .describe('Per-project role');

export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

/**
 * Project membership — grants a user access to a specific project.
 *
 * Unique by `(projectId, userId)`.
 */
export const ProjectMemberSchema = z.object({
  /** UUID of the membership. */
  id: z.string().uuid().describe('UUID of the membership'),

  /** Project this membership grants access to. */
  projectId: z.string().uuid().describe('Project this membership grants access to'),

  /** User ID (references `user` in the control plane). */
  userId: z.string().describe('User ID'),

  /** Per-project role. */
  role: ProjectRoleSchema.describe('Per-project role'),

  /** User ID of the member who invited / granted this membership. */
  invitedBy: z.string().describe('User ID that granted this membership'),

  /** Creation timestamp. */
  createdAt: z.string().datetime().describe('Creation timestamp (ISO-8601)'),

  /** Last update timestamp. */
  updatedAt: z.string().datetime().describe('Last update timestamp (ISO-8601)'),
});

export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

// ---------------------------------------------------------------------------
// Provisioning requests / responses
// ---------------------------------------------------------------------------

/**
 * Request to provision a new project for an organization.
 */
export const ProvisionProjectRequestSchema = z.object({
  organizationId: z.string().describe('Organization that will own the new project'),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .describe('Slug unique per organization'),
  displayName: z.string().optional().describe('Display name (defaults to slug)'),
  projectType: ProjectTypeSchema.describe('Project type'),
  region: z.string().optional().describe('Region preference for the physical DB'),
  driver: ProjectDriverSchema.optional().describe('Driver key (defaults to provisioning service config)'),
  plan: TenantPlanSchema.optional().describe('Plan tier'),
  storageLimitMb: z.number().int().positive().optional().describe('Storage quota in megabytes'),
  isDefault: z.boolean().optional().describe('Mark as the organization default project'),
  createdBy: z.string().describe('User ID that initiated the provisioning'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Free-form metadata'),
  hostname: z.string().optional().describe('Canonical hostname for this project (auto-generated if omitted)'),
});

export type ProvisionProjectRequest = z.infer<typeof ProvisionProjectRequestSchema>;

/**
 * Response of a successful project provisioning call.
 */
export const ProvisionProjectResponseSchema = z.object({
  project: ProjectSchema.describe('Provisioned project (includes database addressing)'),
  credential: ProjectCredentialSchema.describe('Freshly-minted credential for the project DB'),
  durationMs: z.number().describe('Total provisioning duration in milliseconds'),
  warnings: z.array(z.string()).optional().describe('Non-fatal warnings emitted during provisioning'),
});

export type ProvisionProjectResponse = z.infer<typeof ProvisionProjectResponseSchema>;

/**
 * Request to bootstrap a brand-new organization — allocates the default
 * project (and its DB) in one atomic call.
 */
export const ProvisionOrganizationRequestSchema = z.object({
  organizationId: z.string().describe('Organization being bootstrapped'),
  defaultProjectType: ProjectTypeSchema.default('production').describe('Project type for the default project'),
  defaultProjectSlug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .default('prod')
    .describe('Slug for the default project'),
  region: z.string().optional().describe('Region preference'),
  driver: ProjectDriverSchema.optional().describe('Driver key'),
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
  defaultProject: ProvisionProjectResponseSchema.describe('Default project that was created'),
  durationMs: z.number().describe('Total bootstrap duration in milliseconds'),
  warnings: z.array(z.string()).optional().describe('Non-fatal warnings'),
});

export type ProvisionOrganizationResponse = z.infer<typeof ProvisionOrganizationResponseSchema>;

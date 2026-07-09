// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';
import { RowLevelSecurityPolicySchema } from './rls.zod';

/**
 * Entity (Object) Level Permissions
 * Defines CRUD + VAMA (View All / Modify All) + Lifecycle access.
 * 
 * Refined with enterprise data lifecycle controls:
 * - Transfer (Ownership change)
 * - Restore (Soft delete recovery)
 * - Purge (Hard delete / Compliance)
 */
import { lazySchema } from '../shared/lazy-schema';
/**
 * [ADR-0057 D1] Object access DEPTH — the Dataverse "access level" axis,
 * layered on top of OWD. Widens the owner-match for owner-scoped objects.
 */
export const ObjectAccessScopeSchema = z.enum(['own', 'own_and_reports', 'unit', 'unit_and_below', 'org']);
export type ObjectAccessScope = z.infer<typeof ObjectAccessScopeSchema>;

export const ObjectPermissionSchema = lazySchema(() => z.object({
  /** C: Create */
  allowCreate: z.boolean().default(false).describe('Create permission'),
  /** R: Read (Owned records or Shared records) */
  allowRead: z.boolean().default(false).describe('Read permission'),
  /** U: Edit (Owned records or Shared records) */
  allowEdit: z.boolean().default(false).describe('Edit permission'),
  /** D: Delete (Owned records or Shared records) */
  allowDelete: z.boolean().default(false).describe('Delete permission'),
  
  /**
   * Lifecycle Operations.
   *
   * RBAC-gated, operations pending (#1883 / roadmap M2). The
   * `transfer`/`restore`/`purge` ObjectQL operations do not exist yet, but the
   * permission evaluator PRE-MAPS them to these bits
   * (`permission-evaluator.ts` OPERATION_TO_PERMISSION): the moment such an
   * operation is dispatched it is denied unless a resolved permission set
   * grants the bit (or `modifyAllRecords`). Until the operations ship,
   * authoring these bits grants nothing — there is no ungated window either
   * way (unmapped destructive ops additionally fail CLOSED via
   * DESTRUCTIVE_OPERATIONS, per ADR-0049).
   */
  allowTransfer: z.boolean().default(false).describe('[RBAC-gated; operation pending M2] Change record ownership'),
  allowRestore: z.boolean().default(false).describe('[RBAC-gated; operation pending M2] Restore from trash (Undelete)'),
  allowPurge: z.boolean().default(false).describe('[RBAC-gated; operation pending M2] Permanently delete (Hard Delete/GDPR)'),

  /** 
   * View All Records: Super-user read access. 
   * Bypasses Sharing Rules and Ownership checks.
   * Equivalent to Microsoft Dataverse "Organization" level read access.
   */
  viewAllRecords: z.boolean().default(false).describe('View All Data (Bypass Sharing)'),
  
  /** 
   * Modify All Records: Super-user write access. 
   * Bypasses Sharing Rules and Ownership checks.
   * Equivalent to Microsoft Dataverse "Organization" level write access.
   */
  modifyAllRecords: z.boolean().default(false).describe('Modify All Data (Bypass Sharing)'),

  /**
   * [ADR-0057 D1] Read access DEPTH (Dataverse-style access level), layered on
   * top of OWD. For owner-scoped (`private`) objects it widens the owner-match:
   * `own` (owner only) | `own_and_reports` (me + my sys_user.manager_id
   * report chain) | `unit` (my business unit) | `unit_and_below` (my BU +
   * descendants) | `org` (whole tenant). Unset = `own` baseline. Resolved into
   * an `owner_id IN (…)` set at request time; sharing rules still widen on top.
   */
  readScope: ObjectAccessScopeSchema.optional().describe('[ADR-0057 D1] Read depth: own|unit|unit_and_below|org'),
  /** [ADR-0057 D1] Write (edit/delete) access DEPTH — same enum as readScope. */
  writeScope: ObjectAccessScopeSchema.optional().describe('[ADR-0057 D1] Write depth: own|unit|unit_and_below|org'),
}));

/**
 * Field Level Security (FLS)
 */
export const FieldPermissionSchema = lazySchema(() => z.object({
  /** Can see this field */
  readable: z.boolean().default(true).describe('Field read access'),
  /** Can edit this field */
  editable: z.boolean().default(false).describe('Field edit access'),
}));

/**
 * Permission Set Schema
 * Defines a collection of permissions that can be assigned to users.
 * 
 * DIFFERENTIATION (ADR-0090):
 * - Permission Set: the ONLY capability container — union-merged, additive.
 * - Position (src/identity/position.zod.ts): flat distribution group that
 *   binds sets to people. There is no Profile concept (ADR-0090 D2).
 * - Business Unit: the visibility hierarchy (ADR-0057).
 * 
 * **NAMING CONVENTION:**
 * Permission set names MUST be lowercase snake_case to prevent security issues.
 * 
 * @example Good permission set names
 * - 'read_only'
 * - 'system_admin'
 * - 'standard_user'
 * - 'api_access'
 * 
 * @example Bad permission set names (will be rejected)
 * - 'ReadOnly' (camelCase)
 * - 'SystemAdmin' (mixed case)
 * - 'Read Only' (spaces)
 */
export const PermissionSetSchema = lazySchema(() => z.object({
  /** Unique permission set name */
  name: SnakeCaseIdentifierSchema.describe('Permission set unique name (lowercase snake_case)'),
  
  /** Display label */
  label: z.string().optional().describe('Display label'),

  /**
   * [ADR-0086 D3] Owning package for a package-shipped permission set
   * (absent ⇒ environment-authored). Persisted on `sys_permission_set`
   * records together with the per-record `managedBy` provenance, this is
   * what makes the metadata↔config boundary machine-checkable and package
   * uninstall well-defined (remove the package's own sets).
   */
  packageId: z.string().optional().describe('[ADR-0086 D3] Owning package id for a package-shipped set (absent = env-authored)'),

  /**
   * [ADR-0086 D3] Per-record provenance on the existing
   * metadata-persistence axis (`package | platform | user`):
   * `package` = versioned package metadata (seeded by
   * `bootstrapDeclaredPermissions`, re-seeded on upgrade, read-mostly for
   * admins per ADR-0010); `platform`/`user` = environment config, live-edited
   * and never touched by package seeding. Distinct from the `sys_permission_set`
   * TABLE's object-affordance `managedBy: 'config'`, which stays.
   */
  managedBy: z.enum(['package', 'platform', 'user']).optional()
    .describe('[ADR-0086 D3] Record provenance: package (upgrade-owned metadata) vs platform/user (env config)'),

  /**
   * [ADR-0090 D5] Package SUGGESTION: on install the admin is prompted to bind
   * this set to the built-in `everyone` position (default grants for
   * authenticated users). Never auto-bound; carries no runtime semantics of
   * its own. (The former `isProfile` flag was removed by ADR-0090 D2.)
   */
  isDefault: z.boolean().default(false).describe('[ADR-0090 D5] Install-time suggestion to bind this set to the everyone position (admin confirms; never auto-bound)'),
  
  /** Object Permissions Map: <entity_name> -> permissions */
  objects: z.record(z.string(), ObjectPermissionSchema).describe('Entity permissions'),
  
  /** Field Permissions Map: <entity_name>.<field_name> -> permissions */
  fields: z.record(z.string(), FieldPermissionSchema).optional().describe('Field level security'),
  
  /** System permissions (e.g., "manage_users") */
  systemPermissions: z.array(z.string()).optional().describe('System level capabilities'),
  
  /**
   * Tab/App Visibility Permissions (Salesforce Pattern)
   * Controls which app tabs are visible, hidden, or set as default for this permission set.
   * 
   * @example
   * ```typescript
   * tabPermissions: {
   *   'app_crm': 'visible',
   *   'app_admin': 'hidden',
   *   'app_sales': 'default_on'
   * }
   * ```
   */
  tabPermissions: z.record(z.string(), z.enum(['visible', 'hidden', 'default_on', 'default_off'])).optional()
    .describe('App/tab visibility: visible, hidden, default_on (shown by default), default_off (available but hidden initially)'),
  
  /** 
   * Row-Level Security Rules
   * 
   * Row-level security policies that filter records based on user context.
   * These rules are applied in addition to object-level permissions.
   * 
   * Uses the canonical RLS protocol from rls.zod.ts for comprehensive
   * row-level security features including PostgreSQL-style USING and CHECK clauses.
   * 
   * @see {@link RowLevelSecurityPolicySchema} for full RLS specification
   * @see {@link file://./rls.zod.ts} for comprehensive RLS documentation
   * 
   * @example Multi-tenant isolation
   * ```typescript
   * rls: [{
   *   name: 'tenant_filter',
   *   object: 'account',
   *   operation: 'select',
   *   using: 'organization_id == current_user.organization_id'
   * }]
   * ```
   */
  rowLevelSecurity: z.array(RowLevelSecurityPolicySchema).optional()
    .describe('Row-level security policies (see rls.zod.ts for full spec)'),
  
  /**
   * Context-Based Access Control Variables
   * 
   * Custom context variables that can be referenced in RLS rules.
   * These variables are evaluated at runtime based on the user's session.
   * 
   * Common context variables:
   * - `current_user.id` - Current user ID
   * - `current_user.organization_id` - Active organization id
   * - `current_user.department` - User's department
   * - `current_user.role` - User's role
   * - `current_user.region` - User's geographic region
   * 
   * @example Custom context
   * ```typescript
   * contextVariables: {
   *   allowed_regions: ['US', 'EU'],
   *   access_level: 2,
   *   custom_attribute: 'value'
   * }
   * ```
   */
  contextVariables: z.record(z.string(), z.unknown()).optional().describe('Context variables for RLS evaluation'),
}));

export type PermissionSet = z.infer<typeof PermissionSetSchema>;
/** Authoring input for {@link PermissionSet} — defaulted fields are optional. */
export type PermissionSetInput = z.input<typeof PermissionSetSchema>;
export type ObjectPermission = z.infer<typeof ObjectPermissionSchema>;
export type FieldPermission = z.infer<typeof FieldPermissionSchema>;

/**
 * Type-safe factory for a permission set. Validates at authoring time via
 * `.parse()` and accepts input-shape config (optional defaults, CEL
 * shorthand) — preferred over a bare `: PermissionSet` literal.
 */
export function definePermissionSet(config: z.input<typeof PermissionSetSchema>): PermissionSet {
  return PermissionSetSchema.parse(config);
}

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
export const ObjectPermissionSchema = z.object({
  /** C: Create */
  allowCreate: z.boolean().default(false).describe('Create permission'),
  /** R: Read (Owned records or Shared records) */
  allowRead: z.boolean().default(false).describe('Read permission'),
  /** U: Edit (Owned records or Shared records) */
  allowEdit: z.boolean().default(false).describe('Edit permission'),
  /** D: Delete (Owned records or Shared records) */
  allowDelete: z.boolean().default(false).describe('Delete permission'),
  
  /** Lifecycle Operations */
  allowTransfer: z.boolean().default(false).describe('Change record ownership'),
  allowRestore: z.boolean().default(false).describe('Restore from trash (Undelete)'),
  allowPurge: z.boolean().default(false).describe('Permanently delete (Hard Delete/GDPR)'),

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
});

/**
 * Field Level Security (FLS)
 */
export const FieldPermissionSchema = z.object({
  /** Can see this field */
  readable: z.boolean().default(true).describe('Field read access'),
  /** Can edit this field */
  editable: z.boolean().default(false).describe('Field edit access'),
});

/**
 * Permission Set Schema
 * Defines a collection of permissions that can be assigned to users.
 * 
 * DIFFERENTIATION:
 * - Profile: The ONE primary functional definition of a user (e.g. Standard User).
 * - Permission Set: Add-on capabilities assigned to users (e.g. Export Reports).
 * - Role: (Defined in src/system/role.zod.ts) Defines data visibility hierarchy.
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
export const PermissionSetSchema = z.object({
  /** Unique permission set name */
  name: SnakeCaseIdentifierSchema.describe('Permission set unique name (lowercase snake_case)'),
  
  /** Display label */
  label: z.string().optional().describe('Display label'),
  
  /** Is this a Profile? (Base set for a user) */
  isProfile: z.boolean().default(false).describe('Whether this is a user profile'),
  
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
   *   using: 'tenant_id = current_user.tenant_id'
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
   * - `current_user.tenant_id` - User's tenant/organization ID
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
});

export type PermissionSet = z.infer<typeof PermissionSetSchema>;
export type ObjectPermission = z.infer<typeof ObjectPermissionSchema>;
export type FieldPermission = z.infer<typeof FieldPermissionSchema>;

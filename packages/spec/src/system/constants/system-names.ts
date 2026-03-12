// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// ============================================================================
// System Namespace — The Canonical Identifier for Built-in Objects
// ============================================================================

/**
 * The canonical namespace for all built-in system objects.
 *
 * Every system object's protocol-level name is derived as `{SYSTEM_NAMESPACE}_{short_name}`.
 * This constant MUST be used by all consumers (Studio, plugins, routes) to identify
 * system-scoped metadata instead of hardcoded `'sys'` literals.
 *
 * @example
 * ```ts
 * import { SYSTEM_NAMESPACE } from '@objectstack/spec/system';
 *
 * // Filter objects by namespace
 * const sysObjects = objects.filter(o => o.namespace === SYSTEM_NAMESPACE);
 *
 * // Build API query
 * fetch(`/api/v1/objects?namespace=${SYSTEM_NAMESPACE}`);
 * ```
 */
export const SYSTEM_NAMESPACE = 'sys' as const;

/** Type literal for the system namespace. */
export type SystemNamespace = typeof SYSTEM_NAMESPACE;

// ============================================================================
// System Object Names — Protocol Layer Constants
// ============================================================================

/**
 * System Object Names — Protocol Layer Constants
 *
 * These constants define the canonical, protocol-level names for system objects.
 * All API calls, SDK references, permissions checks, and metadata lookups MUST use
 * these names instead of hardcoded strings or physical table names.
 *
 * The actual storage table name may differ via `ObjectSchema.tableName`.
 * The mapping between protocol name and storage name is handled by the
 * ObjectQL Engine / Driver layer.
 *
 * @example
 * ```ts
 * import { SystemObjectName } from '@objectstack/spec/system';
 *
 * // Always use the constant for API / SDK / permission references
 * const users = await engine.find(SystemObjectName.USER, { ... });
 * ```
 */
export const SystemObjectName = {
  /** Authentication: user identity */
  USER: 'sys_user',
  /** Authentication: active session */
  SESSION: 'sys_session',
  /** Authentication: OAuth / credential account */
  ACCOUNT: 'sys_account',
  /** Authentication: email / phone verification */
  VERIFICATION: 'sys_verification',
  /** Authentication: organization (multi-org support) */
  ORGANIZATION: 'sys_organization',
  /** Authentication: organization member */
  MEMBER: 'sys_member',
  /** Authentication: organization invitation */
  INVITATION: 'sys_invitation',
  /** Authentication: team within an organization */
  TEAM: 'sys_team',
  /** Authentication: team membership */
  TEAM_MEMBER: 'sys_team_member',
  /** Authentication: API key for programmatic access */
  API_KEY: 'sys_api_key',
  /** Authentication: two-factor authentication credentials */
  TWO_FACTOR: 'sys_two_factor',
  /** Security: role definition for RBAC */
  ROLE: 'sys_role',
  /** Security: permission set grouping */
  PERMISSION_SET: 'sys_permission_set',
  /** Audit: system audit log */
  AUDIT_LOG: 'sys_audit_log',
  /** System metadata storage */
  METADATA: 'sys_metadata',
} as const;

/** Union type of all system object names */
export type SystemObjectName = typeof SystemObjectName[keyof typeof SystemObjectName];

/**
 * System Field Names — Protocol Layer Constants
 *
 * These constants define the canonical, protocol-level names for common system fields.
 * All API calls, SDK references, and permission checks MUST use these constants
 * instead of hardcoded strings or physical column names.
 *
 * The actual storage column name may differ via `FieldSchema.columnName`.
 *
 * @example
 * ```ts
 * import { SystemFieldName } from '@objectstack/spec/system';
 *
 * // Use the constant to reference the owner field in queries
 * const myRecords = await engine.find('project', {
 *   filters: [SystemFieldName.OWNER_ID, '=', currentUserId],
 * });
 * ```
 */
export const SystemFieldName = {
  /** Primary key */
  ID: 'id',
  /** Record creation timestamp */
  CREATED_AT: 'created_at',
  /** Record last-updated timestamp */
  UPDATED_AT: 'updated_at',
  /** Record owner (lookup to user) */
  OWNER_ID: 'owner_id',
  /** Tenant isolation key */
  TENANT_ID: 'tenant_id',
  /** Foreign key to user on session / account objects */
  USER_ID: 'user_id',
  /** Soft-delete timestamp */
  DELETED_AT: 'deleted_at',
} as const;

/** Union type of all system field names */
export type SystemFieldName = typeof SystemFieldName[keyof typeof SystemFieldName];

/**
 * Storage Name Mapping — Protocol ↔ Physical Name Resolution
 *
 * Provides pure utility functions for resolving protocol-level names to
 * physical storage names and vice-versa.
 *
 * These helpers are intended for use inside the ObjectQL Engine and Driver layers.
 * They are intentionally stateless — they receive the object definition and return
 * the resolved name.
 */
export const StorageNameMapping = {
  /**
   * Resolve the physical table name for an object.
   * Priority: explicit `tableName` → auto-derived `{namespace}_{name}` → `name`.
   *
   * @param object - Object definition (at minimum `{ name: string; namespace?: string; tableName?: string }`)
   * @returns The physical table / collection name to use in storage operations.
   */
  resolveTableName(object: { name: string; namespace?: string; tableName?: string }): string {
    return object.tableName ?? (object.namespace ? `${object.namespace}_${object.name}` : object.name);
  },

  /**
   * Resolve the physical column name for a field.
   * Falls back to `fieldKey` when `columnName` is not set on the field.
   *
   * @param fieldKey - The protocol-level field key (snake_case identifier).
   * @param field    - Field definition (at minimum `{ columnName?: string }`).
   * @returns The physical column name to use in storage operations.
   */
  resolveColumnName(fieldKey: string, field: { columnName?: string }): string {
    return field.columnName ?? fieldKey;
  },

  /**
   * Build a complete field-key → column-name map for an entire object.
   *
   * @param fields - The fields record from an ObjectSchema.
   * @returns A record mapping every protocol field key to its physical column name.
   */
  buildColumnMap(fields: Record<string, { columnName?: string }>): Record<string, string> {
    const map: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      map[key] = fields[key].columnName ?? key;
    }
    return map;
  },

  /**
   * Build a reverse column-name → field-key map for an entire object.
   * Useful for translating storage-layer results back to protocol-level field keys.
   *
   * @param fields - The fields record from an ObjectSchema.
   * @returns A record mapping every physical column name back to its protocol field key.
   */
  buildReverseColumnMap(fields: Record<string, { columnName?: string }>): Record<string, string> {
    const map: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      const col = fields[key].columnName ?? key;
      map[col] = key;
    }
    return map;
  },
} as const;

// ============================================================================
// System Permission Names — `sys::` Prefixed Permission Identifiers
// ============================================================================

/**
 * System Permission Names — Protocol Layer Constants
 *
 * All platform-level permission identifiers use the `sys::` prefix to
 * distinguish them from application-level permissions. Plugins, role management,
 * approval engines, and permission-set definitions MUST reference these constants
 * instead of hardcoded strings.
 *
 * Convention: `sys::{capability}` where `{capability}` is lowercase snake_case.
 *
 * @example
 * ```ts
 * import { SystemPermissionName } from '@objectstack/spec/system';
 *
 * const adminPermissions: PermissionSet = {
 *   name: 'system_admin',
 *   systemPermissions: [
 *     SystemPermissionName.MANAGE_USERS,
 *     SystemPermissionName.VIEW_ALL_DATA,
 *     SystemPermissionName.MANAGE_METADATA,
 *   ],
 * };
 * ```
 */
export const SystemPermissionName = {
  // ── User & Identity Management ─────────────────────────────────────
  /** Create, update, deactivate user accounts */
  MANAGE_USERS: 'sys::manage_users',
  /** Manage organizations (create, edit, delete) */
  MANAGE_ORGANIZATIONS: 'sys::manage_organizations',
  /** Manage teams within organizations */
  MANAGE_TEAMS: 'sys::manage_teams',

  // ── Access Control ─────────────────────────────────────────────────
  /** Manage RBAC role definitions */
  MANAGE_ROLES: 'sys::manage_roles',
  /** Manage permission set definitions */
  MANAGE_PERMISSION_SETS: 'sys::manage_permission_sets',
  /** Create and revoke API keys */
  MANAGE_API_KEYS: 'sys::manage_api_keys',

  // ── Data Access ────────────────────────────────────────────────────
  /** View all records regardless of ownership / sharing rules */
  VIEW_ALL_DATA: 'sys::view_all_data',
  /** Modify all records regardless of ownership / sharing rules */
  MODIFY_ALL_DATA: 'sys::modify_all_data',

  // ── Platform Administration ────────────────────────────────────────
  /** Access setup / admin console */
  VIEW_SETUP: 'sys::view_setup',
  /** Customize objects, fields, layouts, and automations */
  CUSTOMIZE_APPLICATION: 'sys::customize_application',
  /** Read and write system metadata */
  MANAGE_METADATA: 'sys::manage_metadata',

  // ── Audit & Reporting ──────────────────────────────────────────────
  /** View the audit log */
  VIEW_AUDIT_LOG: 'sys::view_audit_log',
  /** Execute reports / dashboards */
  RUN_REPORTS: 'sys::run_reports',
  /** Export report data */
  EXPORT_REPORTS: 'sys::export_reports',
} as const;

/** Union type of all system permission name values */
export type SystemPermissionName = typeof SystemPermissionName[keyof typeof SystemPermissionName];

// ============================================================================
// System Event Names — `sys::` Prefixed Event Identifiers
// ============================================================================

/**
 * System Event Names — Protocol Layer Constants
 *
 * All platform-level event identifiers use the `sys::` prefix followed by
 * `{object}.{action}` to distinguish system lifecycle events from
 * application-level events. Workflow engines, trigger registries, and
 * audit consumers MUST reference these constants.
 *
 * Convention: `sys::{object}.{action}` where both parts are lowercase snake_case.
 *
 * @example
 * ```ts
 * import { SystemEventName } from '@objectstack/spec/system';
 *
 * kernel.on(SystemEventName.USER_CREATED, async (event) => {
 *   await auditService.log('user_created', event.payload);
 * });
 * ```
 */
export const SystemEventName = {
  // ── User Lifecycle ─────────────────────────────────────────────────
  /** A user record was created */
  USER_CREATED: 'sys::user.created',
  /** A user record was updated */
  USER_UPDATED: 'sys::user.updated',
  /** A user record was deleted / deactivated */
  USER_DELETED: 'sys::user.deleted',

  // ── Session Lifecycle ──────────────────────────────────────────────
  /** A session was created (login) */
  SESSION_CREATED: 'sys::session.created',
  /** A session expired or was revoked (logout) */
  SESSION_EXPIRED: 'sys::session.expired',

  // ── Access Control Events ──────────────────────────────────────────
  /** A role was assigned to a user */
  ROLE_ASSIGNED: 'sys::role.assigned',
  /** A role was revoked from a user */
  ROLE_REVOKED: 'sys::role.revoked',
  /** Permission set changed (assigned / revoked / modified) */
  PERMISSION_CHANGED: 'sys::permission.changed',

  // ── Organization & Team Events ─────────────────────────────────────
  /** An organization was created */
  ORGANIZATION_CREATED: 'sys::organization.created',
  /** A team was created */
  TEAM_CREATED: 'sys::team.created',
  /** A member was added (to org or team) */
  MEMBER_ADDED: 'sys::member.added',
  /** A member was removed (from org or team) */
  MEMBER_REMOVED: 'sys::member.removed',

  // ── API Key Lifecycle ──────────────────────────────────────────────
  /** An API key was created */
  API_KEY_CREATED: 'sys::api_key.created',
  /** An API key was revoked */
  API_KEY_REVOKED: 'sys::api_key.revoked',

  // ── Platform Events ────────────────────────────────────────────────
  /** Audit log entry recorded */
  AUDIT_LOG_CREATED: 'sys::audit_log.created',
  /** Metadata definition was updated */
  METADATA_UPDATED: 'sys::metadata.updated',
} as const;

/** Union type of all system event name values */
export type SystemEventName = typeof SystemEventName[keyof typeof SystemEventName];

// ============================================================================
// System Route Paths — Canonical API Endpoints for System Objects
// ============================================================================

/**
 * System Route Paths — Protocol Layer Constants
 *
 * Canonical route patterns for system object API access. Frontend routes,
 * admin consoles, and API clients MUST reference these constants to ensure
 * platform-wide route consistency.
 *
 * @example
 * ```ts
 * import { SystemRoutePath } from '@objectstack/spec/system';
 *
 * // Frontend navigation
 * router.push(SystemRoutePath.SYSTEM_OBJECTS);
 *
 * // API call
 * fetch(`${baseUrl}${SystemRoutePath.API_OBJECTS}?namespace=sys`);
 * ```
 */
export const SystemRoutePath = {
  // ── Frontend Routes ────────────────────────────────────────────────
  /** Base path for all system pages in the admin console */
  SYSTEM_PREFIX: '/system',
  /** System object list page */
  SYSTEM_OBJECTS: '/system/objects',
  /** System object detail page (`:name` is the object name) */
  SYSTEM_OBJECT_DETAIL: '/system/objects/:name',

  // ── API Routes ─────────────────────────────────────────────────────
  /** REST base path for object metadata */
  API_OBJECTS: '/api/v1/objects',
  /** REST path for a single object by name */
  API_OBJECT_BY_NAME: '/api/v1/objects/:name',
  /** REST data endpoint for a system object (`:object` is the object name) */
  API_DATA: '/api/v1/data/:object',
  /** REST data endpoint for a single record */
  API_DATA_RECORD: '/api/v1/data/:object/:id',
} as const;

/** Union type of all system route path values */
export type SystemRoutePath = typeof SystemRoutePath[keyof typeof SystemRoutePath];

// ============================================================================
// SystemRef — Identifier Builders & Guards
// ============================================================================

/**
 * SystemRef — Identifier Builders & Guards
 *
 * Pure utility helpers for constructing and recognizing system-scoped
 * identifiers at runtime. These prevent string interpolation mistakes
 * and centralize the `sys::` / `sys_` prefix logic.
 *
 * @example
 * ```ts
 * import { SystemRef } from '@objectstack/spec/system';
 *
 * SystemRef.permission('manage_users');   // → 'sys::manage_users'
 * SystemRef.event('user', 'created');     // → 'sys::user.created'
 * SystemRef.isSystemObject('sys_user');   // → true
 * SystemRef.isSystemPermission('sys::manage_users'); // → true
 * ```
 */
export const SystemRef = {
  /**
   * Build a system permission identifier.
   * @param name - Permission capability name (snake_case, without prefix).
   * @returns Fully qualified permission string `sys::{name}`.
   */
  permission(name: string): string {
    return `sys::${name}`;
  },

  /**
   * Build a system event identifier.
   * @param object - Object short name (snake_case, without prefix).
   * @param action - Lifecycle action (e.g. `created`, `updated`, `deleted`).
   * @returns Fully qualified event string `sys::{object}.{action}`.
   */
  event(object: string, action: string): string {
    return `sys::${object}.${action}`;
  },

  /**
   * Check whether a name belongs to the system namespace (`sys_` prefix).
   * Useful for filtering system objects from user-defined objects.
   */
  isSystemObject(name: string): boolean {
    return name.startsWith('sys_');
  },

  /**
   * Check whether a permission belongs to the system namespace (`sys::` prefix).
   */
  isSystemPermission(permission: string): boolean {
    return permission.startsWith('sys::');
  },

  /**
   * Check whether an event belongs to the system namespace (`sys::` prefix).
   */
  isSystemEvent(event: string): boolean {
    return event.startsWith('sys::');
  },
} as const;

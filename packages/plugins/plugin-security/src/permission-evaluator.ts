// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { PermissionSet, ObjectPermission, FieldPermission } from '@objectstack/spec/security';

/**
 * Operation type mapping to permission checks
 */
const OPERATION_TO_PERMISSION: Record<string, keyof ObjectPermission> = {
  find: 'allowRead',
  findOne: 'allowRead',
  count: 'allowRead',
  aggregate: 'allowRead',
  insert: 'allowCreate',
  update: 'allowEdit',
  delete: 'allowDelete',
};

/**
 * Destructive operation class — operations that must FAIL CLOSED when they are
 * not mapped to a concrete permission key. See ADR-0049: an unrecognised
 * destructive operation (e.g. a future `transfer`/`restore`/`purge` added
 * without a matching `OPERATION_TO_PERMISSION` entry, gated by the spec's
 * `allowTransfer`/`allowRestore`/`allowPurge` bits) must be DENIED rather than
 * silently allowed by the default-allow fallthrough. Non-destructive unknown
 * operations retain default-allow so custom read-side operations are not broken.
 */
const DESTRUCTIVE_OPERATIONS = new Set<string>(['transfer', 'restore', 'purge']);

/**
 * PermissionEvaluator
 * 
 * Runtime evaluator for PermissionSet definitions.
 * Resolves aggregated permissions from roles to concrete allow/deny decisions.
 */
export class PermissionEvaluator {
  /**
   * Check if an operation is allowed on an object for the given permission sets.
   * Uses "most permissive" merging: if ANY permission set allows, it's allowed.
   */
  checkObjectPermission(
    operation: string,
    objectName: string,
    permissionSets: PermissionSet[]
  ): boolean {
    const permKey = OPERATION_TO_PERMISSION[operation];
    if (!permKey) {
      // Fail CLOSED for the destructive operation class (ADR-0049): an
      // unrecognised destructive op must be denied, never silently allowed.
      // Other unknown operations are allowed by default.
      return !DESTRUCTIVE_OPERATIONS.has(operation);
    }

    for (const ps of permissionSets) {
      // Honour the `'*'` wildcard sentinel — admin permission sets typically
      // grant blanket access via a single `objects: { '*': … }` entry rather
      // than enumerating every system object.
      const objPerm = ps.objects?.[objectName] ?? ps.objects?.['*'];
      if (objPerm) {
        // Check if modifyAllRecords is set (super-user bypass for write ops)
        if (['allowEdit', 'allowDelete'].includes(permKey) && objPerm.modifyAllRecords) {
          return true;
        }
        // Check if viewAllRecords is set (super-user bypass for read ops)
        if (permKey === 'allowRead' && (objPerm.viewAllRecords || objPerm.modifyAllRecords)) {
          return true;
        }
        // Check the specific permission
        if (objPerm[permKey]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the merged field permissions for an object.
   * Returns a map of field names to their effective permissions.
   * Uses "most permissive" merging.
   */
  getFieldPermissions(
    objectName: string,
    permissionSets: PermissionSet[]
  ): Record<string, FieldPermission> {
    const result: Record<string, FieldPermission> = {};

    for (const ps of permissionSets) {
      if (!ps.fields) continue;

      for (const [key, perm] of Object.entries(ps.fields)) {
        // Field keys are in format: "object_name.field_name"
        if (!key.startsWith(`${objectName}.`)) continue;
        const fieldName = key.substring(objectName.length + 1);

        if (!result[fieldName]) {
          result[fieldName] = { readable: false, editable: false };
        }

        // Most permissive merge
        if (perm.readable) result[fieldName].readable = true;
        if (perm.editable) result[fieldName].editable = true;
      }
    }

    return result;
  }

  /**
   * Resolve permission sets for a list of identifier names from metadata.
   *
   * Identifiers are matched to `PermissionSet.name`. The names may be
   * either role names (when `sys_role.name` is reused as a permission set
   * name — common for default admin/member/viewer roles) or explicit
   * permission set names supplied through `ExecutionContext.permissions[]`
   * (resolved by `resolveExecutionContext` from `sys_user_permission_set`
   * and `sys_role_permission_set`).
   *
   * Async because the underlying metadata service exposes `list()` as a
   * Promise — synchronous iteration would silently yield zero results
   * (the historical SecurityPlugin behaviour, masking all enforcement).
   *
   * `bootstrapPermissionSets` is a fallback list of plugin-owned permission
   * sets (typically the platform defaults: admin_full_access /
   * member_default / viewer_readonly) that are registered via
   * `manifest.register({ permissions })` but do not currently propagate
   * into the metadata service's `list()` index. Without this fallback,
   * SecurityPlugin would never resolve the defaults and all enforcement
   * would be silently disabled for authenticated requests.
   */
  async resolvePermissionSets(
    identifiers: string[],
    metadataService: any,
    bootstrapPermissionSets: PermissionSet[] = [],
    /**
     * Optional async loader for permission set names that aren't found in
     * metadata or bootstrap. Lets callers query user-defined permission
     * sets persisted in `sys_permission_set`. Failures are swallowed.
     */
    dbLoader?: (unresolved: string[]) => Promise<PermissionSet[]>
  ): Promise<PermissionSet[]> {
    if (identifiers.length === 0) return [];

    const result: PermissionSet[] = [];
    const seen = new Set<string>();

    // Get all permission sets from metadata. Support both async (Manager) and
    // sync (test stub) implementations of `list`.
    let allPermSets: any = [];
    try {
      const listed = metadataService?.list?.('permission')
        ?? metadataService?.list?.('permissions')
        ?? [];
      allPermSets = typeof (listed as any)?.then === 'function' ? await listed : listed;
    } catch {
      allPermSets = [];
    }
    if (!Array.isArray(allPermSets)) allPermSets = [];

    const wanted = new Set(identifiers);
    for (const ps of allPermSets) {
      if (wanted.has(ps.name) && !seen.has(ps.name)) {
        seen.add(ps.name);
        result.push(ps);
      }
    }

    // Fallback: any wanted name not yet matched is sourced from the
    // bootstrap list (plugin-owned defaults). Avoids silent failure when
    // permission sets are registered via `manifest.register` but the
    // metadata service hasn't indexed them.
    for (const ps of bootstrapPermissionSets) {
      if (wanted.has(ps.name) && !seen.has(ps.name)) {
        seen.add(ps.name);
        result.push(ps);
      }
    }

    // Last-resort: query user-defined permission sets from the database.
    // Without this, custom permission sets (created via the admin UI as
    // `sys_permission_set` rows) would be silently ignored both for CRUD
    // enforcement and for field-level masking.
    if (dbLoader) {
      const unresolved = identifiers.filter((n) => !seen.has(n));
      if (unresolved.length > 0) {
        try {
          const dbRows = await dbLoader(unresolved);
          for (const ps of dbRows ?? []) {
            if (ps?.name && !seen.has(ps.name)) {
              seen.add(ps.name);
              result.push(ps);
            }
          }
        } catch {
          // Swallow — the request shouldn't fail just because the DB
          // lookup is unavailable.
        }
      }
    }

    return result;
  }
}

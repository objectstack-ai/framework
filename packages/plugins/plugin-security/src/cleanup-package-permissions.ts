// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * cleanupPackagePermissions — uninstall-time revocation of a package's
 * data-plane permission rows (ADR-0086 D3, #2747).
 *
 * ADR-0090 D5 promises: "uninstalling the package (removing its sets by
 * `packageId`) revokes it everywhere at once. No ghost grants." The
 * `package_id`/`managed_by` provenance columns (and the `package_id` index on
 * `sys_permission_set`) exist precisely for this query; this module is the
 * wiring that consumes them. Registered with the protocol's uninstall-cleanup
 * seam (the mirror of the publish materializer) so `deletePackage` triggers it
 * without the protocol layer learning `sys_permission_set`'s shape.
 *
 * Scope — provenance rules identical to the seeder's (ADR-0086 D4):
 *  - ONLY rows `managed_by: 'package'` with `package_id` = the uninstalled
 *    package are touched. Env-authored sets (`platform`/`user`/absent) and
 *    other packages' sets are never removed, even on a name collision.
 *  - Bindings referencing a removed set (`sys_position_permission_set`,
 *    `sys_user_permission_set`) are deleted first, so no dangling grant rows
 *    survive and re-resolution never sees a half-removed state.
 *  - `sys_audience_binding_suggestion` rows for the package are removed in
 *    every status: with the sets gone, confirmed/dismissed history points at
 *    nothing, and a fresh reinstall should re-prompt (D5 — admin confirms).
 *
 * System-context writes: uninstall is a package-door operation, exactly like
 * the boot seeder — the admin already authorized it by uninstalling.
 */

const SYSTEM_CTX = { isSystem: true };

// Engine signatures: `find(object, query)` and `delete(object, options)` both
// read `context` from their SECOND argument — a trailing `{ context }` arg is
// silently ignored, which turns a system write into a principal-less one that
// the D12 gate correctly fails CLOSED on the governed RBAC tables.
async function tryFind(ql: any, object: string, where: any, limit = 1000): Promise<any[]> {
  try {
    const rows = await ql.find(object, { where, limit, context: SYSTEM_CTX });
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

/** Delete rows by id one at a time; returns how many were removed. */
async function deleteRows(ql: any, object: string, rows: any[]): Promise<number> {
  let removed = 0;
  for (const row of rows) {
    if (!row?.id) continue;
    try {
      await ql.delete(object, { where: { id: row.id }, context: SYSTEM_CTX });
      removed += 1;
    } catch { /* per-row best-effort; count reflects reality */ }
  }
  return removed;
}

export interface PackagePermissionCleanupOutcome {
  /** Package-owned sys_permission_set rows removed. */
  sets: number;
  /** sys_position_permission_set rows referencing those sets. */
  positionBindings: number;
  /** sys_user_permission_set rows referencing those sets. */
  userGrants: number;
  /** sys_audience_binding_suggestion rows for the package (any status). */
  suggestions: number;
}

export async function cleanupPackagePermissions(
  ql: any,
  packageId: string,
  logger?: { info?: (m: string, meta?: any) => void; warn?: (m: string, meta?: any) => void },
): Promise<PackagePermissionCleanupOutcome> {
  const out: PackagePermissionCleanupOutcome = { sets: 0, positionBindings: 0, userGrants: 0, suggestions: 0 };
  if (!ql || typeof ql.find !== 'function' || typeof ql.delete !== 'function' || !packageId) return out;

  // Provenance-scoped: only the package door's own rows (ADR-0086 D4).
  // `managed_by` is filtered in JS — a multi-column where on the readonly
  // provenance columns doesn't match through the engine's query layer
  // (verified empirically), while the single-column package_id filter does.
  const sets = (await tryFind(ql, 'sys_permission_set', { package_id: packageId }))
    .filter((r) => r?.managed_by === 'package');

  // Bindings first — a set row must never outlive its grants in reverse.
  for (const set of sets) {
    if (!set?.id) continue;
    out.positionBindings += await deleteRows(
      ql, 'sys_position_permission_set',
      await tryFind(ql, 'sys_position_permission_set', { permission_set_id: set.id }),
    );
    out.userGrants += await deleteRows(
      ql, 'sys_user_permission_set',
      await tryFind(ql, 'sys_user_permission_set', { permission_set_id: set.id }),
    );
  }
  out.sets = await deleteRows(ql, 'sys_permission_set', sets);

  // Suggestion rows in every status — reinstall re-prompts fresh (D5).
  out.suggestions = await deleteRows(
    ql, 'sys_audience_binding_suggestion',
    await tryFind(ql, 'sys_audience_binding_suggestion', { package_id: packageId }),
  );

  if (out.sets + out.positionBindings + out.userGrants + out.suggestions > 0) {
    logger?.info?.('[security] package permission rows revoked on uninstall (#2747)', {
      packageId, ...out,
    });
  }
  return out;
}

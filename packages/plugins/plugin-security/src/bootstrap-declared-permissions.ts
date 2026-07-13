// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * bootstrapDeclaredPermissions — seed stack-declared `permissions` into
 * `sys_permission_set` (ADR-0086 D5; the exact sibling of
 * `bootstrapDeclaredPositions`).
 *
 * `stack.permissions` has always been declarable and runtime-ENFORCED (the
 * evaluator resolves declared sets through the metadata registry), but it was
 * never materialized as `sys_permission_set` records — the ADR-0078
 * inert-metadata smell: the admin surface (which reads the table) can't see a
 * package's sets, uninstall is undefined, and no provenance axis exists. This
 * seeder closes that gap:
 *
 *  - each declared set is upserted by `name` with `managed_by: 'package'` and
 *    `package_id` = the registering package (`_packageId` stamped by the
 *    SchemaRegistry / ADR-0010 `applyProtection`, with the spec-level
 *    `packageId` (ADR-0086 D3) as the author-declared fallback);
 *  - IDEMPOTENT + UPGRADE-AWARE: a row this seeder owns
 *    (`managed_by:'package'`, same `package_id`) is re-seeded on every boot so
 *    the record always reflects the shipped declaration (version bumps
 *    included). Rows owned by a DIFFERENT package are skipped loudly;
 *  - env-authored rows are NEVER clobbered: `managed_by` of
 *    `platform`/`user` — or absent (legacy/pre-provenance rows, including the
 *    platform defaults inserted by `bootstrapPlatformAdmin`) — is left alone.
 *
 * Runs on `kernel:ready` after `bootstrapPlatformAdmin` (so the platform
 * defaults keep their existing insert-once shape) and alongside
 * `bootstrapDeclaredPositions`.
 */

const SYSTEM_CTX = { isSystem: true };

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rand}`;
}

async function tryFind(ql: any, object: string, where: any, limit = 100): Promise<any[]> {
  try {
    const rows = await ql.find(object, { where, limit }, { context: SYSTEM_CTX });
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}
async function tryInsert(ql: any, object: string, data: any): Promise<any | null> {
  try { return await ql.insert(object, data, { context: SYSTEM_CTX }); } catch { return null; }
}
async function tryUpdate(ql: any, object: string, data: any): Promise<boolean> {
  try { await ql.update(object, data, { context: SYSTEM_CTX }); return true; } catch { return false; }
}

interface SeedOptions {
  logger?: { info: (m: string, meta?: Record<string, any>) => void; warn: (m: string, meta?: Record<string, any>) => void };
}

/**
 * Read declared metadata items of a type. The engine's SchemaRegistry
 * (populated by `manifest.register` from the stack's `permissions` array,
 * items provenance-stamped with `_packageId`) is the reliable source in every
 * boot path; the metadata-service facade only surfaces these once the
 * compiled-artifact loader runs (serve.ts).
 */
export function readDeclared(engine: any, type: string): any[] {
  try {
    const reg = engine?._registry;
    if (reg?.listItems) {
      return (reg.listItems(type) ?? []).map((i: any) => i?.content ?? i).filter(Boolean);
    }
  } catch { /* fall through */ }
  return [];
}

/** Serialize a declared PermissionSet into the sys_permission_set row shape
 *  (mirrors bootstrapPlatformAdmin so both seed paths hydrate identically). */
function toRowFields(ps: any): Record<string, any> {
  return {
    label: ps.label ?? ps.name,
    description: ps.description ?? null,
    object_permissions: JSON.stringify(ps.objects ?? {}),
    field_permissions: JSON.stringify(ps.fields ?? {}),
    system_permissions: JSON.stringify(ps.systemPermissions ?? []),
    row_level_security: JSON.stringify(ps.rowLevelSecurity ?? []),
    tab_permissions: JSON.stringify(ps.tabPermissions ?? {}),
    // [ADR-0090 D12] Delegated-admin scope travels with the set row so the
    // delegated-admin gate can resolve a DB-loaded delegate's authority.
    admin_scope: ps.adminScope ? JSON.stringify(ps.adminScope) : null,
  };
}

export interface PermissionSeedOutcome {
  seeded: number;
  updated: number;
  skippedEnvAuthored: number;
  skippedForeign: number;
}

/**
 * Upsert ONE declared/published PermissionSet body into `sys_permission_set`
 * under the owning `packageId`, applying the ADR-0086 provenance rules
 * (own-row re-seed, foreign-package refuse, env-authored never clobbered).
 * Shared by the boot seeder (every declared set) and the publish-time
 * materializer (ADR-0086 P2 — a package-door set promoted from a draft). Returns
 * a one-hot outcome so callers can aggregate.
 */
export async function upsertPackagePermissionSet(
  ql: any,
  ps: any,
  packageId: string | null | undefined,
  logger?: SeedOptions['logger'],
): Promise<PermissionSeedOutcome> {
  const out: PermissionSeedOutcome = { seeded: 0, updated: 0, skippedEnvAuthored: 0, skippedForeign: 0 };
  if (!ps?.name) return out;
  // A `managed_by:'package'` row without a `package_id` would make uninstall
  // undefined again — the exact ambiguity ADR-0086 D3 exists to remove — so a
  // set with no resolvable owner is skipped rather than materialized unowned.
  if (!packageId) {
    logger?.warn?.('[security] permission set has no owning package — not materialized', { name: ps.name });
    return out;
  }

  const existing = (await tryFind(ql, 'sys_permission_set', { name: ps.name }, 1))[0];
  if (!existing?.id) {
    const created = await tryInsert(ql, 'sys_permission_set', {
      id: genId('ps'),
      name: ps.name,
      ...toRowFields(ps),
      active: true,
      package_id: packageId,
      managed_by: 'package',
    });
    if (created) out.seeded += 1;
    return out;
  }

  if (existing.managed_by === 'package') {
    if (existing.package_id === packageId) {
      // Our own row — re-seed so the record always reflects the shipped/published
      // declaration (idempotent; covers version bumps without bookkeeping).
      if (await tryUpdate(ql, 'sys_permission_set', { id: existing.id, ...toRowFields(ps) })) {
        out.updated += 1;
      }
    } else {
      // Package-namespaced object api names make set-name collisions a
      // packaging bug, not a merge case — refuse loudly (ADR-0086 D4:
      // a package never writes into a foreign record).
      out.skippedForeign += 1;
      logger?.warn?.('[security] permission set name owned by another package — skipped', {
        name: ps.name, declaredBy: packageId, ownedBy: existing.package_id,
      });
    }
    return out;
  }

  // `platform`/`user` — or absent (legacy rows, incl. bootstrapPlatformAdmin
  // defaults): env-authored config. Never clobbered by package materialization.
  out.skippedEnvAuthored += 1;
  return out;
}

/**
 * Project an ENVIRONMENT-authored PermissionSet body onto its
 * `sys_permission_set` row — the mirror image of {@link upsertPackagePermissionSet}
 * for the environment door (ADR-0086 two-doors; framework#2857).
 *
 * An env-scope `save('permission', name, body)` writes only the `sys_metadata`
 * overlay; nothing projected the six facet columns onto the queryable
 * `sys_permission_set` record, so the admin/Setup surface (which reads the
 * record) went stale while the layered read showed the edit — split-brain.
 * This closes that gap for env-authored sets: it owns rows whose `managed_by`
 * is NOT `'package'` (i.e. `platform`/`user`/absent) and REFUSES to touch a
 * package-owned row — a package's record mirrors its declaration and changes
 * only via boot re-seed / publish, never through an env override.
 */
export async function upsertEnvPermissionSet(
  ql: any,
  ps: any,
  logger?: SeedOptions['logger'],
): Promise<PermissionSeedOutcome> {
  const out: PermissionSeedOutcome = { seeded: 0, updated: 0, skippedEnvAuthored: 0, skippedForeign: 0 };
  if (!ql || typeof ql.find !== 'function' || !ps?.name) return out;

  // Ownership is decided by the EXISTING RECORD's `managed_by`, never the body:
  // the layered read stamps `_packageId` provenance on env-authored sets too
  // (a declared-then-env-overridden set), so the body cannot tell the two doors
  // apart — only the record's provenance can.
  const existing = (await tryFind(ql, 'sys_permission_set', { name: ps.name }, 1))[0];
  if (!existing?.id) {
    // No data record. A set's admin-surface row is created through the data API
    // (the Setup "New" flow), not the metadata door, so there is nothing to
    // project here — leave creation to that path / the boot seeder.
    return out;
  }

  // A package-owned record is the package's declared baseline (re-seeded at
  // boot / on publish); an env override lives in the overlay/effective layer,
  // not this row. Refusing here keeps the two doors from fighting.
  if (existing.managed_by === 'package') {
    out.skippedForeign += 1;
    logger?.warn?.('[security] env permission save targets a package-owned set — record left at package baseline', { name: ps.name });
    return out;
  }

  // Env-authored row (platform / user / absent provenance): project the saved
  // facets so the record matches the layered read the editor shows.
  if (await tryUpdate(ql, 'sys_permission_set', { id: existing.id, ...toRowFields(ps) })) {
    out.updated += 1;
  }
  return out;
}

/**
 * Handle one `permission` metadata-mutation event (framework#2857): re-read the
 * FRESH effective body via the protocol's layered read — the boot-time metadata
 * registry would hand back a stale declared body — and project it onto the env
 * record. Exported (and Promise-returning) so the wiring is unit-testable
 * without the dev server. Returns the projection outcome, or `null` when the
 * event is skipped (draft, non-permission, or no readable body).
 */
export async function projectEnvPermissionOnMutation(
  protocol: any,
  ql: any,
  evt: { type?: string; name?: string; state?: string; organizationId?: string | null } | null | undefined,
  logger?: SeedOptions['logger'],
): Promise<PermissionSeedOutcome | null> {
  if (evt?.type !== 'permission' || evt.state === 'draft' || !evt.name) return null;
  let body: any = null;
  if (protocol && typeof protocol.getMetaItemLayered === 'function') {
    const layered = await protocol.getMetaItemLayered({
      type: 'permission',
      name: evt.name,
      ...(evt.organizationId ? { environmentId: evt.organizationId } : {}),
    });
    // `getMetaItemLayered` may return a layered envelope (`{ effective | code }`)
    // OR the effective body directly (top-level `name`/`systemPermissions`) —
    // accept both so a body isn't silently dropped.
    body = layered?.effective ?? layered?.code ?? layered ?? null;
  }
  if (!body?.name) return null;
  return upsertEnvPermissionSet(ql, body, logger);
}

/**
 * Subscribe env-permission projection to the protocol's post-persistence
 * mutation choke point (framework#2857). Returns the unsubscribe fn, or `null`
 * when the protocol doesn't expose `onMetadataMutation`.
 */
export function subscribeEnvPermissionProjection(
  protocol: any,
  ql: any,
  logger?: SeedOptions['logger'],
): (() => void) | null {
  if (!protocol || typeof protocol.onMetadataMutation !== 'function') return null;
  return protocol.onMetadataMutation((evt: any) => {
    void projectEnvPermissionOnMutation(protocol, ql, evt, logger).catch((err: any) => {
      logger?.warn?.('[security] env permission projection after save failed', {
        name: evt?.name, error: err?.message,
      });
    });
  });
}

export async function bootstrapDeclaredPermissions(
  ql: any,
  metadataService: any,
  options: SeedOptions = {},
): Promise<PermissionSeedOutcome> {
  const out: PermissionSeedOutcome = { seeded: 0, updated: 0, skippedEnvAuthored: 0, skippedForeign: 0 };
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') return out;

  let sets: any[] = readDeclared(ql, 'permission');
  if (sets.length === 0) {
    try {
      const listed = metadataService?.list?.('permission');
      sets = typeof (listed as any)?.then === 'function' ? await listed : (listed ?? []);
    } catch { sets = []; }
  }
  if (!Array.isArray(sets) || sets.length === 0) return out;

  for (const ps of sets) {
    if (!ps?.name) continue;
    // Registry provenance first (ADR-0010 `_packageId`), author-declared
    // spec `packageId` (ADR-0086 D3) as fallback.
    const packageId: string | undefined = ps._packageId ?? ps.packageId ?? undefined;
    const r = await upsertPackagePermissionSet(ql, ps, packageId, options.logger);
    out.seeded += r.seeded;
    out.updated += r.updated;
    out.skippedEnvAuthored += r.skippedEnvAuthored;
    out.skippedForeign += r.skippedForeign;
  }

  options.logger?.info?.('[security] declared permission sets seeded into sys_permission_set (ADR-0086 D5)', {
    ...out, total: sets.length,
  });
  return out;
}

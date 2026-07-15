// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * bootstrapDeclaredCapabilities — seed stack-declared `capabilities` into
 * `sys_capability` with PACKAGE provenance (ADR-0066 D1; the exact sibling of
 * `bootstrapDeclaredPermissions`).
 *
 * A package's authorization capabilities used to reach the registry only
 * IMPLICITLY: `bootstrapSystemCapabilities` derived an untitled placeholder for
 * any capability string a permission set happened to reference in
 * `systemPermissions[]`, seeded `managed_by:'platform'` with a humanized label.
 * That back-door gave the registry no way to attribute a capability to the
 * package that owns it, nor to carry a real label/description.
 *
 * `defineCapability` + `stack.capabilities` is the EXPLICIT declaration entry
 * point (ADR-0066 D1: "packages DEFINE capabilities"). This seeder materializes
 * those declarations:
 *
 *  - each declared capability is upserted by `name` with `managed_by:'package'`
 *    and `package_id` = the registering package (`_packageId` stamped by the
 *    SchemaRegistry / ADR-0010, with the spec-level `packageId` (ADR-0086 D3)
 *    as the author-declared fallback);
 *  - a name that collides with a CURATED platform capability
 *    (`PLATFORM_CAPABILITY_NAMES`) is refused loudly — those are platform-owned
 *    and a package must not hijack them;
 *  - a pre-existing `managed_by:'platform'` row for a NON-curated name is a
 *    derived-from-systemPermissions placeholder — the explicit declaration
 *    CLAIMS it (upgrades it to package provenance with the authored metadata),
 *    which is the whole point: retire the implicit back-door;
 *  - IDEMPOTENT + UPGRADE-AWARE: a row this seeder owns (`managed_by:'package'`,
 *    same `package_id`) is re-seeded on every boot so the record always
 *    reflects the shipped declaration. Rows owned by a DIFFERENT package are
 *    skipped loudly;
 *  - admin-authored rows (`managed_by:'admin'`) are NEVER clobbered.
 *
 * Runs on `kernel:ready` in `@objectstack/plugin-security` alongside the other
 * declared-metadata seeders. The set of declared names is returned so the
 * caller can tell `bootstrapSystemCapabilities` to SKIP re-deriving (and thus
 * clobbering) an explicitly-declared capability.
 */

import {
  genId,
  tryFind,
  tryInsert,
  tryUpdate,
  type ProjectionLogger,
} from './permission-set-projection.js';
import { readDeclared } from './bootstrap-declared-permissions.js';
import { PLATFORM_CAPABILITY_NAMES } from '@objectstack/spec/security';

interface SeedOptions {
  logger?: ProjectionLogger;
}

/** Aggregated outcome of a declared-capability seeding pass. */
export interface CapabilitySeedOutcome {
  seeded: number;
  updated: number;
  claimed: number;
  skippedAdmin: number;
  skippedForeign: number;
  skippedPlatform: number;
  /** Names of every capability EXPLICITLY declared (regardless of seed outcome). */
  declaredNames: string[];
}

function humanize(name: string): string {
  return name.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalize a declaration body into the `sys_capability` platform-owned fields. */
function capabilityRowFields(cap: any): { label: string; description: string; scope: 'platform' | 'org' } {
  return {
    label: typeof cap.label === 'string' && cap.label ? cap.label : humanize(cap.name),
    description: typeof cap.description === 'string' && cap.description ? cap.description : `Capability ${cap.name}.`,
    scope: cap.scope === 'org' ? 'org' : 'platform',
  };
}

/**
 * Upsert ONE declared capability into `sys_capability` under the owning
 * `packageId`, applying the ADR-0066 D1 provenance rules (own-row re-seed,
 * derived-platform-row claim, curated/foreign/admin refuse-or-skip).
 */
async function upsertPackageCapability(
  ql: any,
  cap: any,
  packageId: string | null | undefined,
  out: CapabilitySeedOutcome,
  logger?: ProjectionLogger,
): Promise<void> {
  if (!cap?.name) return;

  // Curated platform capabilities are platform-owned — a package must never
  // claim one (that would let it silently redefine `manage_users`, `setup.access`, …).
  if (PLATFORM_CAPABILITY_NAMES.has(cap.name)) {
    out.skippedPlatform += 1;
    logger?.warn?.('[security] capability name is a curated platform capability — not materialized as package', { name: cap.name });
    return;
  }

  // A `managed_by:'package'` row without a `package_id` makes uninstall
  // undefined (the ambiguity ADR-0086 D3 removes) — skip an unowned declaration.
  if (!packageId) {
    logger?.warn?.('[security] capability has no owning package — not materialized', { name: cap.name });
    return;
  }

  const fields = capabilityRowFields(cap);
  const existing = (await tryFind(ql, 'sys_capability', { name: cap.name }, 1))[0];

  if (!existing?.id) {
    const created = await tryInsert(ql, 'sys_capability', {
      id: genId('cap'),
      name: cap.name,
      ...fields,
      managed_by: 'package',
      package_id: packageId,
      active: true,
    });
    if (created) out.seeded += 1;
    return;
  }

  if (existing.managed_by === 'package') {
    if (existing.package_id === packageId) {
      // Our own row — re-seed so it always reflects the shipped declaration.
      if (await tryUpdate(ql, 'sys_capability', { id: existing.id, ...fields })) out.updated += 1;
    } else {
      out.skippedForeign += 1;
      logger?.warn?.('[security] capability name owned by another package — skipped', {
        name: cap.name, declaredBy: packageId, ownedBy: existing.package_id,
      });
    }
    return;
  }

  if (existing.managed_by === 'platform') {
    // Non-curated (curated excluded above) platform row = a derived-from-
    // systemPermissions placeholder. The explicit declaration CLAIMS it:
    // upgrade to package provenance with the authored label/description/scope.
    if (await tryUpdate(ql, 'sys_capability', { id: existing.id, ...fields, managed_by: 'package', package_id: packageId })) {
      out.claimed += 1;
    }
    return;
  }

  // `admin` (or any other) — environment/admin-authored. Never clobbered.
  out.skippedAdmin += 1;
}

export async function bootstrapDeclaredCapabilities(
  ql: any,
  metadataService: any,
  options: SeedOptions = {},
): Promise<CapabilitySeedOutcome> {
  const out: CapabilitySeedOutcome = {
    seeded: 0, updated: 0, claimed: 0, skippedAdmin: 0, skippedForeign: 0, skippedPlatform: 0, declaredNames: [],
  };
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') return out;

  let caps: any[] = readDeclared(ql, 'capability');
  if (caps.length === 0) {
    try {
      const listed = metadataService?.list?.('capability');
      caps = typeof (listed as any)?.then === 'function' ? await listed : (listed ?? []);
    } catch { caps = []; }
  }
  if (!Array.isArray(caps) || caps.length === 0) return out;

  for (const cap of caps) {
    if (!cap?.name) continue;
    out.declaredNames.push(cap.name);
    // Registry provenance first (ADR-0010 `_packageId`), author-declared
    // spec `packageId` (ADR-0086 D3) as fallback.
    const packageId: string | undefined = cap._packageId ?? cap.packageId ?? undefined;
    await upsertPackageCapability(ql, cap, packageId, out, options.logger);
  }

  options.logger?.info?.('[security] declared capabilities seeded into sys_capability (ADR-0066 D1)', {
    ...out, total: caps.length,
  });
  return out;
}

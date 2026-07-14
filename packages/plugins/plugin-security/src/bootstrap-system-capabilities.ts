// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * bootstrapSystemCapabilities — back-compat seed the capability registry
 * (ADR-0066 D1).
 *
 * Promotes the platform's authorization capabilities from bare strings to
 * first-class `sys_capability` records. Idempotently upserts (by `name`):
 *   1. a CURATED set of well-known platform capabilities (label/description/
 *      scope), and
 *   2. any capability referenced by the seeded permission sets'
 *      `systemPermissions[]` that isn't in the curated set (derived defaults),
 * so every string a default grant references resolves to a definition record
 * while existing string references keep working unchanged (no migration).
 *
 * Pre-launch posture: upsert only — never prune (admins may add their own
 * capabilities in Setup; package-declared capabilities arrive via their own
 * seeding). Platform-seeded rows are `managed_by: 'platform'` so they are not
 * presented as admin-deletable. Runs on `kernel:ready` alongside the other
 * security bootstraps.
 */

import { PLATFORM_CAPABILITIES, type PlatformCapability } from '@objectstack/spec/security';

const SYSTEM_CTX = { isSystem: true };

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rand}`;
}

async function tryFind(ql: any, object: string, where: any, limit = 1): Promise<any[]> {
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

type CapabilityDef = PlatformCapability;

/**
 * Well-known platform capabilities. Re-exported from the canonical spec registry
 * (`@objectstack/spec/security` `PLATFORM_CAPABILITIES`) so the seeder and the
 * authoring lint (ADR-0066 ⑨) share ONE source of truth. `managed_by` is always
 * `'platform'` for these. Kept as a named export for back-compat consumers/tests.
 */
export const KNOWN_CAPABILITIES: readonly CapabilityDef[] = PLATFORM_CAPABILITIES;

function humanize(name: string): string {
  return name
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SeedOptions {
  logger?: { info?: (m: string, meta?: Record<string, any>) => void; warn?: (m: string, meta?: Record<string, any>) => void };
  /**
   * [ADR-0066 D1] Capability names that a package has EXPLICITLY declared via
   * `defineCapability` (materialized by `bootstrapDeclaredCapabilities`). The
   * implicit derived-defaults path SKIPS these so it never overwrites an
   * authored capability's label/description/scope (or its package provenance)
   * with a humanized placeholder. Curated platform capabilities are unaffected.
   */
  declaredCapabilityNames?: Iterable<string>;
}

export async function bootstrapSystemCapabilities(
  ql: any,
  permissionSets: Array<{ systemPermissions?: string[] }> = [],
  options: SeedOptions = {},
): Promise<{ seeded: number; updated: number; total: number }> {
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') {
    return { seeded: 0, updated: 0, total: 0 };
  }

  const declared = new Set<string>(options.declaredCapabilityNames ?? []);

  // Build the full definition set: curated first, then any extra capability
  // string referenced by the seeded permission sets (derived defaults) — EXCEPT
  // ones a package explicitly declared, which the declared seeder owns.
  const byName = new Map<string, CapabilityDef>();
  for (const c of KNOWN_CAPABILITIES) byName.set(c.name, c);
  for (const ps of permissionSets) {
    for (const cap of ps?.systemPermissions ?? []) {
      if (typeof cap === 'string' && cap && !byName.has(cap) && !declared.has(cap)) {
        byName.set(cap, { name: cap, label: humanize(cap), description: `Capability ${cap}.`, scope: 'platform' });
      }
    }
  }

  let seeded = 0;
  let updated = 0;
  for (const def of byName.values()) {
    const existing = await tryFind(ql, 'sys_capability', { name: def.name }, 1);
    if (existing[0]?.id) {
      // Keep label/description/scope fresh, but do NOT clobber admin edits to
      // managed_by/active — only platform-owned fields are reconciled.
      if (await tryUpdate(ql, 'sys_capability', { id: existing[0].id, label: def.label, description: def.description, scope: def.scope })) {
        updated += 1;
      }
    } else {
      const created = await tryInsert(ql, 'sys_capability', {
        id: genId('cap'),
        name: def.name,
        label: def.label,
        description: def.description,
        scope: def.scope,
        managed_by: 'platform',
        active: true,
      });
      if (created) seeded += 1;
    }
  }
  options.logger?.info?.('[security] system capabilities seeded into sys_capability (ADR-0066 D1)', { seeded, updated, total: byName.size });
  return { seeded, updated, total: byName.size };
}

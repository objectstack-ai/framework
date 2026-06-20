// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * bootstrapDeclaredRoles — seed stack-declared `roles` into `sys_role`
 * (ADR-0057 D6, closes #2077).
 *
 * Reads the validated `role` metadata (registered from the stack's `roles: []`
 * via `metadataService.list('role')`) and idempotently upserts each into
 * `sys_role` by `name`, so the runtime role→permission-set resolution
 * (`resolveExecutionContext` → `sys_role` → `sys_role_permission_set`) and
 * sharing-rule role recipients stop being decorative. Runs on `kernel:ready`
 * alongside the platform-admin bootstrap.
 *
 * Pre-launch posture (ADR-0057): upsert only — no prune. Role visibility
 * HIERARCHY is NOT seeded here: per ADR-0057 D5 the role is a capability
 * bundle, and "manager sees subordinates" lives on the `sys_business_unit`
 * tree, not `sys_role.parent`.
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
 * (populated by `manifest.register` from the stack's `roles`/`sharingRules`
 * arrays) is the reliable source in every boot path; the metadata-service
 * facade only surfaces these once the compiled-artifact loader runs (serve.ts).
 */
function readDeclared(engine: any, type: string): any[] {
  try {
    const reg = engine?._registry;
    if (reg?.listItems) {
      return (reg.listItems(type) ?? []).map((i: any) => i?.content ?? i).filter(Boolean);
    }
  } catch { /* fall through */ }
  return [];
}

export async function bootstrapDeclaredRoles(
  ql: any,
  metadataService: any,
  options: SeedOptions = {},
): Promise<{ seeded: number; updated: number }> {
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') {
    return { seeded: 0, updated: 0 };
  }
  let roles: any[] = readDeclared(ql, 'role');
  if (roles.length === 0) {
    try {
      const listed = metadataService?.list?.('role');
      roles = typeof (listed as any)?.then === 'function' ? await listed : (listed ?? []);
    } catch { roles = []; }
  }
  if (!Array.isArray(roles) || roles.length === 0) return { seeded: 0, updated: 0 };

  let seeded = 0;
  let updated = 0;
  for (const r of roles) {
    if (!r?.name) continue;
    const fields = { label: r.label ?? r.name, description: r.description ?? null };
    const existing = await tryFind(ql, 'sys_role', { name: r.name }, 1);
    if (existing[0]?.id) {
      if (await tryUpdate(ql, 'sys_role', { id: existing[0].id, ...fields })) updated += 1;
    } else {
      const created = await tryInsert(ql, 'sys_role', {
        id: genId('role'), name: r.name, ...fields, active: true, is_default: false,
      });
      if (created) seeded += 1;
    }
  }
  options.logger?.info?.('[security] declared roles seeded into sys_role', { seeded, updated, total: roles.length });
  return { seeded, updated };
}

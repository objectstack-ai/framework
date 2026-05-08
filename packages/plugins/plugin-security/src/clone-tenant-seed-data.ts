// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * cloneTenantSeedData — give every newly-registered org its own copy of
 * the demo seed data.
 *
 * Multi-tenant deployments treat each `sys_organization` as a hard
 * isolation boundary. The platform-wide `claimOrphanTenantRows` hook
 * (see `claim-orphan-tenant-rows.ts`) only fires for the very first
 * org — every subsequent user that auto-creates a personal Workspace
 * via `ensureUserHasOrganization` ends up looking at an empty
 * dashboard. For demo / trial-org UX (Salesforce-style "you get a
 * fully populated sandbox on signup"), we want every freshly minted
 * org to receive a private clone of the platform-first org's
 * user-defined data.
 *
 * Strategy:
 *   1. Pick the donor org — the very first `sys_organization`.
 *   2. Walk `ql.registry.getAllObjects()` once to collect schemas
 *      that are user-defined (not `managedBy`, not `sys_*`) AND
 *      declare an `organization_id` field.
 *   3. Pass A — for each donor object, find rows where
 *      `organization_id = donorOrgId`, generate a new id, insert a
 *      shallow copy under `targetOrgId`, recording an
 *      `oldId → newId` map keyed by object name. Lookup field values
 *      pointing at donor rows are left untouched in this pass; the
 *      remap happens in pass B so we don't depend on topological
 *      ordering of inserts.
 *   4. Pass B — for each cloned row, walk its lookup-shaped fields
 *      and rewrite values that match the donor map for the field's
 *      `reference` object.
 *
 * Idempotent: skipped if the target org already has rows in any
 * cloned object, or if no donor org exists, or if the target IS the
 * donor (claim hook handles the donor itself).
 *
 * Best-effort: per-object failures are logged at `warn` and don't
 * abort the rest of the clone. FK fields that reference an object
 * that wasn't cloned (e.g. the lookup target lives in `sys_*`, or
 * the remap key isn't present) are left as-is — broken refs are
 * preferable to losing whole rows.
 */

import type { ServiceObject } from '@objectstack/spec/data';

interface CloneOptions {
  logger?: {
    info: (message: string, meta?: Record<string, any>) => void;
    warn: (message: string, meta?: Record<string, any>) => void;
  };
}

interface FieldDescriptor {
  name: string;
  type?: string;
  reference?: string;
  multiple?: boolean;
}

const SYSTEM_CTX = { isSystem: true };

const SKIP_COPY_FIELDS = new Set<string>([
  'id',
  'created_at',
  'updated_at',
  'organization_id',
]);

function fieldList(schema: ServiceObject): FieldDescriptor[] {
  const fields: any = (schema as any)?.fields;
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields.map((f: any) => ({
      name: f?.name,
      type: f?.type,
      reference: f?.reference,
      multiple: f?.multiple,
    }));
  }
  return Object.entries(fields as Record<string, any>).map(([name, f]) => ({
    name,
    type: f?.type,
    reference: f?.reference,
    multiple: f?.multiple,
  }));
}

function isLookupField(f: FieldDescriptor): boolean {
  return (f.type === 'lookup' || f.type === 'master_detail' || f.type === 'tree') && !!f.reference;
}

function hasOrgField(schema: ServiceObject): boolean {
  return fieldList(schema).some((f) => f.name === 'organization_id');
}

function shortId(): string {
  // Mirror the format `nanoid(16)` used elsewhere in the codebase
  // without pulling a runtime dep here.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function findDonorOrgId(ql: any): Promise<string | null> {
  try {
    const res = await ql.find(
      'sys_organization',
      { orderBy: { created_at: 'asc' }, limit: 1, fields: ['id'] },
      { context: SYSTEM_CTX },
    );
    const list: any[] = Array.isArray(res) ? res : Array.isArray(res?.records) ? res.records : [];
    return list[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function cloneTenantSeedData(
  ql: any,
  targetOrgId: string,
  options: CloneOptions = {},
): Promise<{ object: string; count: number }[]> {
  const logger = options.logger;
  if (!ql || typeof ql.find !== 'function' || typeof ql.insert !== 'function') {
    return [];
  }
  const registry = (ql as any).registry;
  if (!registry || typeof registry.getAllObjects !== 'function') {
    logger?.warn?.('[security] cloneTenantSeedData: registry unavailable');
    return [];
  }

  const donorOrgId = await findDonorOrgId(ql);
  if (!donorOrgId) return [];
  if (donorOrgId === targetOrgId) return [];

  const schemas: ServiceObject[] = registry.getAllObjects().filter(
    (s: any) => s?.name && !s.managedBy && !s.name.startsWith('sys_') && hasOrgField(s),
  );

  // Pass A: clone rows shallowly, build per-object oldId → newId map.
  const remap: Record<string, Record<string, string>> = {};
  const summary: { object: string; count: number }[] = [];
  // Track inserted shadow records so pass B can rewrite their lookups
  // without re-fetching from the DB.
  const inserted: { object: string; newId: string; record: Record<string, unknown>; lookups: FieldDescriptor[] }[] = [];

  for (const schema of schemas) {
    const objectName = schema.name as string;
    try {
      // Idempotency: if target org already has any row in this object,
      // assume a previous clone (or manual data) and skip — never
      // double-clone.
      const existing = await ql.find(
        objectName,
        { where: { organization_id: targetOrgId }, limit: 1, fields: ['id'] },
        { context: SYSTEM_CTX },
      );
      const existingList: any[] = Array.isArray(existing)
        ? existing
        : Array.isArray(existing?.records)
          ? existing.records
          : [];
      if (existingList.length > 0) {
        continue;
      }

      const donorRows = await ql.find(
        objectName,
        { where: { organization_id: donorOrgId }, limit: 10_000 },
        { context: SYSTEM_CTX },
      );
      const rows: any[] = Array.isArray(donorRows)
        ? donorRows
        : Array.isArray(donorRows?.records)
          ? donorRows.records
          : [];
      // eslint-disable-next-line no-console
      (globalThis as any).console?.error?.('[clone:diag]', objectName, 'donor rows:', rows.length);
      if (rows.length === 0) continue;

      const fields = fieldList(schema);
      const lookups = fields.filter(isLookupField);
      const objectRemap: Record<string, string> = (remap[objectName] ??= {});
      let cloned = 0;
      for (const row of rows) {
        const newId = shortId();
        const data: Record<string, unknown> = { id: newId, organization_id: targetOrgId };
        for (const f of fields) {
          if (SKIP_COPY_FIELDS.has(f.name)) continue;
          if (row[f.name] === undefined) continue;
          data[f.name] = row[f.name];
        }
        try {
          await ql.insert(objectName, data, { context: SYSTEM_CTX });
          objectRemap[row.id] = newId;
          inserted.push({ object: objectName, newId, record: data, lookups });
          cloned++;
        } catch (e) {
          // eslint-disable-next-line no-console
          (globalThis as any).console?.error?.('[clone:diag]', objectName, 'insert failed:', (e as Error).message);
          logger?.warn?.('[security] cloneTenantSeedData: insert failed', {
            object: objectName,
            error: (e as Error).message,
          });
        }
      }
      if (cloned > 0) summary.push({ object: objectName, count: cloned });
    } catch (e) {
      logger?.warn?.('[security] cloneTenantSeedData: object failed', {
        object: objectName,
        error: (e as Error).message,
      });
    }
  }

  // Pass B: rewrite lookup field values using the per-object remap so
  // intra-clone relationships stay intact.
  for (const item of inserted) {
    if (item.lookups.length === 0) continue;
    const patch: Record<string, unknown> = {};
    let dirty = false;
    for (const f of item.lookups) {
      const oldVal = item.record[f.name];
      if (oldVal == null) continue;
      const targetMap = remap[f.reference!];
      if (!targetMap) continue;
      if (Array.isArray(oldVal)) {
        const next = oldVal.map((v: any) => (typeof v === 'string' && targetMap[v]) || v);
        if (next.some((v, i) => v !== oldVal[i])) {
          patch[f.name] = next;
          dirty = true;
        }
      } else if (typeof oldVal === 'string' && targetMap[oldVal]) {
        patch[f.name] = targetMap[oldVal];
        dirty = true;
      }
    }
    if (!dirty) continue;
    try {
      await ql.update(item.object, { id: item.newId, ...patch }, { context: SYSTEM_CTX });
    } catch (e) {
      logger?.warn?.('[security] cloneTenantSeedData: lookup remap failed', {
        object: item.object,
        id: item.newId,
        error: (e as Error).message,
      });
    }
  }

  return summary;
}

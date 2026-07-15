// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * [#2926 ②] Position ↔ permission-set bindings for the showcase personas.
 *
 * The permission model is record-authoritative (ADR-0090/0094): bindings live
 * only as `sys_position_permission_set` rows. A fresh deploy used to boot with
 * ZERO bindings — every persona silently degraded to the `everyone` baseline
 * until an admin hand-assigned all sets.
 *
 * This cannot be a declarative SEED: the seed loader runs before the security
 * bootstrap creates the `sys_position` / `sys_permission_set` rows, so the name
 * references cannot resolve and the required lookups fail validation. So we play
 * the admin's part imperatively — inserting each missing binding idempotently
 * (dedup by position+set pair, stable ids).
 *
 * Timing matters. `kernel:ready` handlers run SEQUENTIALLY, each awaited, in
 * registration order (`kernel.ts` `trigger`). The showcase AppPlugin starts
 * BEFORE the Security plugin, so an app hook on `kernel:ready` runs *before*
 * the security bootstrap has created the position/set rows — the rows never
 * appear from inside that hook. We therefore bind on **`kernel:listening`**,
 * the phase the kernel fires only AFTER every `kernel:ready` handler has
 * completed (`kernel.ts` Phase 4 / `lite-kernel.ts`), so the bootstrap rows are
 * guaranteed present.
 *
 * `everyone → showcase_member_default` IS bound here. The security plugin only
 * auto-binds an app's `isDefault` set to `everyone` when that set is
 * application-owned; the showcase ships as a package, so its default lands in
 * `sys_audience_binding_suggestion` (pending admin confirmation) and is NOT
 * live until confirmed. Binding it here keeps the demo's baseline working out
 * of the box, idempotently and alongside the suggestion.
 */

const BINDINGS: ReadonlyArray<readonly [position: string, permissionSet: string]> = [
  ['everyone', 'showcase_member_default'],
  ['contributor', 'showcase_contributor'],
  ['manager', 'showcase_manager'],
  ['exec', 'showcase_executive'],
  ['auditor', 'showcase_auditor'],
  ['ops', 'showcase_ops'],
  ['field_ops_delegate', 'showcase_field_ops_delegate'],
  ['client_portal_user', 'showcase_guest_portal'],
];

const SYS = { isSystem: true } as const;

interface BindHostContext {
  ql: {
    find: (object: string, query: unknown, options?: unknown) => Promise<unknown>;
    insert: (object: string, data: Record<string, unknown>, options?: unknown) => Promise<unknown>;
  };
  logger?: { info?: (...a: unknown[]) => void; warn?: (...a: unknown[]) => void };
  hook?: (event: string, handler: () => Promise<void> | void) => void;
}

/** Find one row by `name`, passing the system context the way the engine's own
 * read path expects it (merged from `query.context`; see objectql `find`). */
async function findOneByName(ctx: BindHostContext, object: string, name: string): Promise<{ id?: string } | undefined> {
  try {
    const rows = (await ctx.ql.find(object, { where: { name }, limit: 1, context: SYS })) as
      | Array<{ id?: string }>
      | { records?: Array<{ id?: string }> };
    if (Array.isArray(rows)) return rows[0];
    return rows?.records?.[0];
  } catch (err) {
    ctx.logger?.warn?.('[showcase] position binding lookup failed', {
      object,
      name,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

export function registerShowcasePositionBindings(ctx: BindHostContext): void {
  const run = async (): Promise<void> => {
    let created = 0;
    for (const [positionName, setName] of BINDINGS) {
      const position = await findOneByName(ctx, 'sys_position', positionName);
      const set = await findOneByName(ctx, 'sys_permission_set', setName);
      if (!position?.id || !set?.id) {
        ctx.logger?.warn?.('[showcase] position binding skipped (row missing)', { position: positionName, set: setName });
        continue;
      }
      const existing = (await ctx.ql.find(
        'sys_position_permission_set',
        { where: { position_id: position.id, permission_set_id: set.id }, limit: 1, context: SYS },
      )) as unknown;
      const hit = Array.isArray(existing) ? existing[0] : (existing as { records?: unknown[] })?.records?.[0];
      if (hit) continue;
      try {
        await ctx.ql.insert(
          'sys_position_permission_set',
          { id: `ppsb_showcase_${positionName}`, position_id: position.id, permission_set_id: set.id },
          { context: SYS },
        );
        created += 1;
      } catch (err) {
        ctx.logger?.warn?.('[showcase] position binding insert failed', {
          position: positionName,
          set: setName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    ctx.logger?.info?.('[showcase] position bindings ensured', { created, total: BINDINGS.length });
  };

  // Bind on `kernel:listening` — the phase that fires only after every
  // `kernel:ready` handler (incl. the security bootstrap that seeds the
  // position/set rows) has completed. Fall back to a deferred immediate run
  // if the host context somehow omits the hook registrar.
  if (typeof ctx.hook === 'function') {
    ctx.hook('kernel:listening', run);
  } else {
    setTimeout(() => void run(), 0);
  }
}

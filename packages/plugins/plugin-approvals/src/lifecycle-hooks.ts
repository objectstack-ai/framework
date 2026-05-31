// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Lifecycle Hooks — node-era record lock (ADR-0019).
 *
 * Approval is now a flow node, so there is no per-object process registry to
 * bind auto-trigger hooks against — a flow decides *when* to open an approval.
 * What remains worth enforcing at the data layer is the **record lock**: while
 * a record has a pending `sys_approval_request`, block edits to it.
 *
 * A single global `beforeUpdate` hook handles every object (the target object
 * of an approval node is only known at flow-run time). For each update it:
 *
 *   1. Skips engine self-writes (status mirror) and `sys_approval_*` bookkeeping.
 *   2. Looks up a pending request for `(object, recordId)`.
 *   3. Reads the lock policy from that request's `node_config_json` snapshot:
 *      - `lockRecord === false` → allow.
 *      - otherwise block, EXCEPT when the only changed field is the configured
 *        `approvalStatusField` (so the status mirror is never blocked) or the
 *        caller is an `admin`.
 *
 * Registered under `packageId: 'plugin-approvals:lock'` so it can be cleanly
 * unbound on plugin stop.
 */

export const APPROVALS_HOOK_PACKAGE = 'plugin-approvals:lock';

interface MinimalEngine {
  registerHook(event: string, handler: (ctx: any) => any | Promise<any>, options?: {
    object?: string | string[];
    priority?: number;
    packageId?: string;
  }): void;
  unregisterHooksByPackage(packageId: string): number;
  find<T = any>(object: string, args: any, opts?: any): Promise<T[]>;
}

interface MinimalLogger {
  debug?: (msg: any, ...rest: any[]) => void;
  info?: (msg: any, ...rest: any[]) => void;
  warn?: (msg: any, ...rest: any[]) => void;
  error?: (msg: any, ...rest: any[]) => void;
}

function parseJson<T = any>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }
  return raw as T;
}

/** The pending request gating a record, plus its snapshotted node config. */
async function pendingRequestFor(
  engine: MinimalEngine,
  objectName: string,
  recordId: string,
): Promise<any | null> {
  try {
    const rows = await engine.find('sys_approval_request', {
      where: { object_name: objectName, record_id: String(recordId), status: 'pending' },
      limit: 1,
    } as any);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

/**
 * Bind the global record-lock hook. Caller is responsible for calling
 * {@link unbindAllHooks} first if re-binding.
 */
export function bindApprovalLockHook(engine: MinimalEngine, logger?: MinimalLogger): void {
  engine.registerHook('beforeUpdate', async (ctx: any) => {
    const id = String((ctx?.input?.id ?? '') as string);
    if (!id) return;
    const object = (ctx?.object ?? ctx?.objectName) as string | undefined;
    // No object name (shouldn't happen) or our own bookkeeping objects → skip.
    if (!object || String(object).startsWith('sys_approval')) return;

    const data = (ctx?.input?.data ?? {}) as Record<string, unknown>;
    const changedFields = Object.keys(data).filter((k) => k !== 'id' && k !== 'updated_at');
    if (changedFields.length === 0) return;

    // Allow engine self-writes (status mirror from the approvals service, etc).
    if ((ctx?.session as any)?.isSystem) return;

    // Allow admin override.
    const roles = (ctx?.session?.roles ?? []) as string[];
    if (Array.isArray(roles) && roles.includes('admin')) return;

    const pending = await pendingRequestFor(engine, object, id);
    if (!pending) return;

    const config = parseJson<any>(pending.node_config_json, {});
    if (config?.lockRecord === false) return;

    // Allow when every changed field is the approval status mirror.
    const mirror = config?.approvalStatusField;
    if (typeof mirror === 'string' && mirror && changedFields.every((f) => f === mirror)) return;

    const err: any = new Error('RECORD_LOCKED: record is locked while an approval is in progress');
    err.code = 'RECORD_LOCKED';
    err.statusCode = 409;
    throw err;
  }, { packageId: APPROVALS_HOOK_PACKAGE, priority: 50 });

  logger?.info?.('[approvals] record-lock hook bound');
}

/** Unregister every hook the lock module registered. */
export function unbindAllHooks(engine: MinimalEngine): number {
  return engine.unregisterHooksByPackage(APPROVALS_HOOK_PACKAGE);
}

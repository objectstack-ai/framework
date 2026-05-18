// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Lifecycle Hooks — Phase B auto-takeover.
 *
 * For each active ApprovalProcess we bind three hooks on its target object:
 *
 *   1. `afterInsert` — evaluate `entryCriteria` against the new record;
 *      if truthy and no pending request exists, auto-submit one.
 *   2. `afterUpdate` — same as above but for updates that newly satisfy
 *      criteria (e.g. amount edited above threshold).
 *   3. `beforeUpdate` — when `lockRecord=true`, block edits to a record
 *      that has a pending request, EXCEPT when the only fields being
 *      changed are the configured `approvalStatusField` (so the engine's
 *      own status mirror is not blocked).
 *
 * All hooks are registered with `packageId: 'plugin-approvals:auto'` so
 * that re-bind on `defineProcess`/`deleteProcess` can call
 * `engine.unregisterHooksByPackage(...)` first.
 */

import { ExpressionEngine } from '@objectstack/formula';
import type { Expression } from '@objectstack/spec';
import type { ApprovalProcessRow } from '@objectstack/spec/contracts';
import type { ApprovalService } from './approval-service.js';

export const APPROVALS_HOOK_PACKAGE = 'plugin-approvals:auto';

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

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

/**
 * Evaluate an entry criteria expression against a record. Returns `true`
 * when no criteria is set (matches everything). Returns `false` on
 * evaluation failure (fail-closed — better to skip than auto-submit on a
 * broken expression).
 */
function evaluateCriteria(criteria: unknown, record: Record<string, unknown>, logger?: MinimalLogger): boolean {
  if (criteria == null || criteria === '' ) return true;
  let expr: Expression;
  if (typeof criteria === 'string') {
    expr = { dialect: 'cel', source: criteria };
  } else if (typeof criteria === 'object' && (criteria as any).dialect) {
    expr = criteria as Expression;
  } else {
    return true;
  }
  if (!expr.source || !expr.source.trim()) return true;
  const r = ExpressionEngine.evaluate<boolean>(expr, { record });
  if (!r.ok) {
    logger?.warn?.('[approvals] entryCriteria evaluation failed; skipping auto-submit', {
      source: expr.source,
      error: r.error.message,
    });
    return false;
  }
  return Boolean(r.value);
}

/** Does this record already have a pending approval request? */
async function hasPendingRequest(
  engine: MinimalEngine,
  objectName: string,
  recordId: string,
): Promise<boolean> {
  try {
    const rows = await engine.find('sys_approval_request', {
      where: { object_name: objectName, record_id: String(recordId), status: 'pending' },
      limit: 1,
    } as any);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Bind auto-trigger + lock hooks for the supplied active processes.
 * Caller is responsible for calling `unbindAll` first if re-binding.
 */
export function bindProcessHooks(
  engine: MinimalEngine,
  service: ApprovalService,
  processes: ApprovalProcessRow[],
  logger?: MinimalLogger,
): void {
  // Group processes by object so we can register one hook per object
  // and fan out internally — keeps the engine's hook map compact.
  const byObject = new Map<string, ApprovalProcessRow[]>();
  for (const p of processes) {
    if (!(p as any).active && !(p as any).is_active) continue;
    if (!p.object_name) continue;
    const list = byObject.get(p.object_name) ?? [];
    list.push(p);
    byObject.set(p.object_name, list);
  }

  for (const [objectName, procs] of byObject.entries()) {
    // ---- auto-trigger (afterInsert) ----
    engine.registerHook('afterInsert', async (ctx: any) => {
      try {
        const record = (ctx?.result ?? ctx?.input?.data ?? {}) as Record<string, unknown>;
        const id = String((record as any)?.id ?? '');
        if (!id) return;
        for (const proc of procs) {
          await tryAutoSubmit(engine, service, proc, objectName, id, record, ctx, logger);
        }
      } catch (err: any) {
        logger?.warn?.('[approvals] afterInsert auto-trigger failed', { error: err?.message });
      }
    }, { object: objectName, packageId: APPROVALS_HOOK_PACKAGE, priority: 200 });

    // ---- auto-trigger (afterUpdate) ----
    engine.registerHook('afterUpdate', async (ctx: any) => {
      // Ignore engine self-writes (status mirror, field_update from
      // post-actions, etc) — otherwise post-finalize updates would loop
      // a fresh approval on every state change.
      if ((ctx?.session as any)?.isSystem) return;
      try {
        const result = (ctx?.result ?? {}) as Record<string, unknown>;
        const id = String((ctx?.input?.id ?? (result as any)?.id ?? '') as string);
        if (!id) return;
        // result may be { affected: 1 } for some drivers; merge previous+input.data as the
        // best-effort record snapshot for criteria evaluation.
        const record: Record<string, unknown> = {
          ...(ctx?.previous ?? {}),
          ...((result as any)?.id ? result : {}),
          ...((ctx?.input?.data ?? {}) as Record<string, unknown>),
          id,
        };
        for (const proc of procs) {
          await tryAutoSubmit(engine, service, proc, objectName, id, record, ctx, logger);
        }
      } catch (err: any) {
        logger?.warn?.('[approvals] afterUpdate auto-trigger failed', { error: err?.message });
      }
    }, { object: objectName, packageId: APPROVALS_HOOK_PACKAGE, priority: 200 });

    // ---- record lock (beforeUpdate) ----
    const lockProcs = procs.filter((p) => (p.definition as any)?.lockRecord !== false);
    if (lockProcs.length === 0) continue;
    engine.registerHook('beforeUpdate', async (ctx: any) => {
      const id = String((ctx?.input?.id ?? '') as string);
      if (!id) return;
      const data = (ctx?.input?.data ?? {}) as Record<string, unknown>;
      const changedFields = Object.keys(data).filter((k) => k !== 'id' && k !== 'updated_at');
      if (changedFields.length === 0) return;

      // Allow engine self-writes (status mirror, field_update from actions, etc).
      if ((ctx?.session as any)?.isSystem) return;

      // Allow when every changed field is an approval status mirror.
      const mirrorFields = new Set<string>();
      for (const p of lockProcs) {
        const f = (p.definition as any)?.approvalStatusField;
        if (typeof f === 'string' && f) mirrorFields.add(f);
      }
      const onlyMirror = changedFields.every((f) => mirrorFields.has(f));
      if (onlyMirror) return;

      // Allow admin override: roles include 'admin'.
      const roles = (ctx?.session?.roles ?? []) as string[];
      if (Array.isArray(roles) && roles.includes('admin')) return;

      const pending = await hasPendingRequest(engine, objectName, id);
      if (!pending) return;

      const err: any = new Error('RECORD_LOCKED: record is locked while an approval is in progress');
      err.code = 'RECORD_LOCKED';
      err.statusCode = 409;
      throw err;
    }, { object: objectName, packageId: APPROVALS_HOOK_PACKAGE, priority: 50 });
  }

  logger?.info?.('[approvals] lifecycle hooks bound', {
    objects: Array.from(byObject.keys()),
    processCount: processes.length,
  });
}

/** Unregister every hook the auto-trigger module ever registered. */
export function unbindAllHooks(engine: MinimalEngine): number {
  return engine.unregisterHooksByPackage(APPROVALS_HOOK_PACKAGE);
}

async function tryAutoSubmit(
  engine: MinimalEngine,
  service: ApprovalService,
  process: ApprovalProcessRow,
  objectName: string,
  recordId: string,
  record: Record<string, unknown>,
  ctx: any,
  logger?: MinimalLogger,
): Promise<void> {
  try {
    const criteria = (process.definition as any)?.entryCriteria;
    const passes = evaluateCriteria(criteria, record, logger);
    if (!passes) return;
    if (await hasPendingRequest(engine, objectName, recordId)) return;
    // Guard: if the record's mirror status field is already a terminal
    // state (approved / rejected / recalled), do NOT auto-submit again —
    // otherwise every post-finalize edit would loop a fresh approval.
    const statusField = (process.definition as any)?.approvalStatusField;
    if (statusField) {
      const current = (record as any)?.[statusField];
      if (current === 'approved' || current === 'rejected' || current === 'recalled') return;
    }

    const submitterId = (ctx?.session?.userId ?? null) as string | null;
    const submitterOrg = (ctx?.session?.tenantId ?? ctx?.session?.organizationId ?? null) as string | null;
    await service.submit({
      object: objectName,
      recordId,
      processName: process.name,
      payload: record,
      submitterId,
    }, { ...SYSTEM_CTX, userId: submitterId ?? undefined, organizationId: submitterOrg ?? undefined, tenantId: submitterOrg ?? undefined } as any);

    logger?.info?.('[approvals] auto-submitted approval', {
      process: process.name,
      object: objectName,
      record: recordId,
    });
  } catch (err: any) {
    if (err?.code === 'DUPLICATE_REQUEST') return;
    logger?.warn?.('[approvals] auto-submit failed', {
      process: process.name,
      object: objectName,
      record: recordId,
      error: err?.message ?? String(err),
    });
  }
}

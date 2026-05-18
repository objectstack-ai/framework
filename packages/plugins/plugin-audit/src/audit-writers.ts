// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { HookContext } from '@objectstack/spec/data';
import type { IDataEngine } from '@objectstack/spec/contracts';

/**
 * Audit writer hook installer.
 *
 * Subscribes to the ObjectQL engine's wildcard `before*` / `after*` lifecycle
 * events and writes:
 *
 *  - `sys_audit_log` rows — immutable, compliance-grade entries with
 *    field-level `old_value` / `new_value` diffs.
 *  - `sys_activity` rows — denormalized, human-readable summaries shown
 *    in the dashboard recent-activity feed and per-record timelines.
 *
 * Skip rules avoid recursion and noise:
 *  - Never audit the audit/activity tables themselves.
 *  - Never audit session/presence/auth tables (high-frequency, low value).
 *  - Read-only operations (`afterFind`) are never audited.
 *
 * All writes go through `ctx.api.sudo()` so they bypass record-level
 * permissions and always succeed regardless of the calling user's RBAC.
 */

/** Tables that are intentionally excluded from audit/activity writes. */
const SKIP_OBJECTS = new Set<string>([
  'sys_audit_log',
  'sys_activity',
  'sys_comment',
  'sys_session',
  'sys_presence',
  'sys_account',
  'sys_account_session',
  'sys_account_verification',
  'sys_account_account',
]);

/** Fields that are noise in diffs (always change, never user-meaningful). */
const NOISE_FIELDS = new Set<string>([
  'updated_at',
  'updated_by',
  'created_at',
  'created_by',
]);

/** Action name produced from a HookContext.event string. */
function actionFor(event: string): 'create' | 'update' | 'delete' | null {
  if (event === 'afterInsert') return 'create';
  if (event === 'afterUpdate') return 'update';
  if (event === 'afterDelete') return 'delete';
  return null;
}

/** Activity type produced from an audit action. */
function activityTypeFor(action: 'create' | 'update' | 'delete'): 'created' | 'updated' | 'deleted' {
  return action === 'create' ? 'created' : action === 'update' ? 'updated' : 'deleted';
}

/**
 * Compute the human-readable record label from a record by trying common
 * label fields. Falls back to record id.
 */
function recordLabel(record: any, id: string): string {
  if (!record || typeof record !== 'object') return id;
  const candidates = ['name', 'subject', 'title', 'full_name', 'label', 'first_name', 'company', 'email'];
  for (const k of candidates) {
    const v = record[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return id;
}

/**
 * Compute a shallow JSON diff between two records. Returns only keys whose
 * value changed (and ignores keys in `NOISE_FIELDS`). Both sides are
 * serialisable via `JSON.stringify` — values that fail to serialise are
 * coerced to `String(value)`.
 */
function diff(before: Record<string, any>, after: Record<string, any>): { old: Record<string, any>; next: Record<string, any> } {
  const oldOut: Record<string, any> = {};
  const newOut: Record<string, any> = {};
  const keys = new Set<string>([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (NOISE_FIELDS.has(k)) continue;
    const b = before?.[k];
    const a = after?.[k];
    if (safeStringify(b) !== safeStringify(a)) {
      oldOut[k] = b ?? null;
      newOut[k] = a ?? null;
    }
  }
  return { old: oldOut, next: newOut };
}

function safeStringify(v: any): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Install audit + activity writers on the given engine. Idempotent per
 * `packageId` — calling twice with the same id replaces the previous
 * registration.
 */
export function installAuditWriters(engine: any, packageId = 'com.objectstack.audit'): void {
  if (!engine || typeof engine.registerHook !== 'function') return;

  // Remove any prior installation so we can safely re-install on hot reload.
  if (typeof engine.unregisterHooksByPackage === 'function') {
    engine.unregisterHooksByPackage(packageId);
  }

  /**
   * beforeUpdate / beforeDelete: capture "previous" snapshot via api.sudo()
   * so we can compute the diff in the afterXxx hook. We attach the snapshot
   * to the context (`(ctx as any).__previous`) since `HookContext.previous`
   * is officially typed but not always populated by the engine itself.
   */
  const captureBefore = async (ctx: HookContext) => {
    if (SKIP_OBJECTS.has(ctx.object)) return;
    const id = (ctx.input as any)?.id;
    if (!id) return; // bulk update/delete — too costly to snapshot every row here
    const api: any = (ctx as any).api;
    if (!api?.sudo) return;
    try {
      const prev = await api.sudo().object(ctx.object).findOne({ where: { id } });
      if (prev) (ctx as any).__previous = prev;
    } catch {
      /* ignore — best-effort */
    }
  };

  engine.registerHook('beforeUpdate', captureBefore, { packageId });
  engine.registerHook('beforeDelete', captureBefore, { packageId });

  /**
   * afterInsert / afterUpdate / afterDelete: write audit_log + activity rows.
   * Errors are swallowed (logged) so user-facing CRUD is never broken by
   * audit failures.
   */
  const writeAudit = async (ctx: HookContext) => {
    if (SKIP_OBJECTS.has(ctx.object)) return;
    const action = actionFor(ctx.event);
    if (!action) return;

    const api: any = (ctx as any).api;
    if (!api?.sudo) return;

    const after: any = ctx.result;
    const before: any = (ctx as any).__previous ?? (ctx as any).previous ?? null;

    // Resolve record id from after (insert/update) or before (delete) or input.
    let recordId: string | undefined =
      (typeof after === 'object' && after?.id) ||
      (typeof before === 'object' && before?.id) ||
      ((ctx.input as any)?.id);
    if (recordId !== undefined) recordId = String(recordId);

    const sess: any = (ctx as any).session ?? {};
    const userId: string | undefined = sess.userId;
    const tenantId: string | undefined = sess.tenantId;

    let oldValue: Record<string, any> | null = null;
    let newValue: Record<string, any> | null = null;
    if (action === 'create') {
      newValue = (after && typeof after === 'object') ? { ...after } : null;
    } else if (action === 'update') {
      const d = diff(before || {}, after || {});
      oldValue = d.old;
      newValue = d.next;
      // If nothing meaningfully changed, skip the audit row to avoid noise.
      if (Object.keys(newValue).length === 0) return;
    } else if (action === 'delete') {
      oldValue = before && typeof before === 'object' ? { ...before } : null;
    }

    const auditRow: Record<string, any> = {
      action,
      user_id: userId ?? null,
      object_name: ctx.object,
      record_id: recordId ?? null,
      old_value: oldValue ? safeStringify(oldValue) : null,
      new_value: newValue ? safeStringify(newValue) : null,
      tenant_id: tenantId ?? null,
    };

    const label = recordLabel(after ?? before, recordId ?? '');
    const summary =
      action === 'create' ? `Created ${ctx.object} "${label}"` :
      action === 'update' ? `Updated ${ctx.object} "${label}"` :
                            `Deleted ${ctx.object} "${label}"`;

    const activityRow: Record<string, any> = {
      type: activityTypeFor(action),
      summary,
      actor_id: userId ?? null,
      object_name: ctx.object,
      record_id: recordId ?? null,
      record_label: label,
      metadata: newValue || oldValue ? safeStringify({ old: oldValue, new: newValue }) : null,
    };

    try {
      const sys = api.sudo();
      await sys.object('sys_audit_log').create(auditRow);
      await sys.object('sys_activity').create(activityRow);
    } catch (err) {
      // Log via engine logger if available, but never throw.
      try { (engine as any).logger?.warn?.('Audit write failed', { object: ctx.object, action, err: String((err as any)?.message ?? err) }); } catch {}
    }
  };

  engine.registerHook('afterInsert', writeAudit, { packageId });
  engine.registerHook('afterUpdate', writeAudit, { packageId });
  engine.registerHook('afterDelete', writeAudit, { packageId });
}

// Re-export for convenience.
export type { IDataEngine };

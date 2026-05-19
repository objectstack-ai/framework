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
    try {
      // Use the engine directly (not api.sudo) so we can thread the
      // active transaction through. On drivers with single-connection
      // pools (e.g. SQLite via knex) a sudo() findOne that does NOT
      // carry the open transaction will deadlock for the full
      // acquireConnectionTimeout (~60s) because the outer transaction
      // holds the only connection.
      const trx = (ctx as any).transaction;
      const ql = (ctx as any).ql ?? (ctx as any).api?.engine;
      if (ql?.findOne) {
        const prev = await ql.findOne(ctx.object, {
          where: { id },
          context: { isSystem: true, ...(trx ? { transaction: trx } : {}) },
        });
        if (prev) (ctx as any).__previous = prev;
        return;
      }
      const api: any = (ctx as any).api;
      if (!api?.sudo) return;
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
      // `tenant_id` is the schema-declared "tenant context" lookup; the
      // platform-default `organization_id` column is what RLS gates on
      // (`organization_id = current_user.organization_id`). The audit
      // writer runs through `api.sudo()` which bypasses the
      // SecurityPlugin's auto-stamping of `organization_id`, so we
      // stamp both columns explicitly here. Without `organization_id`,
      // non-admin members would see 0 rows on Setup dashboards because
      // RLS would deny every audit row as wrong-tenant.
      organization_id: tenantId ?? null,
      tenant_id: tenantId ?? null,
    };

    const label = recordLabel(after ?? before, recordId ?? '');
    const summary =
      action === 'create' ? `Created ${ctx.object} "${label}"` :
      action === 'update' ? `Updated ${ctx.object} "${label}"` :
                            `Deleted ${ctx.object} "${label}"`;

    const activityRow: Record<string, any> = {
      type: activityTypeFor(action),
      // Explicit ISO timestamp — `defaultValue: 'NOW()'` on the column
      // isn't resolved by every driver and would otherwise leak the
      // literal string "NOW()" into the row.
      timestamp: new Date().toISOString(),
      summary,
      actor_id: userId ?? null,
      object_name: ctx.object,
      record_id: recordId ?? null,
      record_label: label,
      metadata: newValue || oldValue ? safeStringify({ old: oldValue, new: newValue }) : null,
      // Same rationale as auditRow: stamp the tenant column so RLS
      // matches the recipient's organization on read.
      organization_id: tenantId ?? null,
    };

    try {
      const sys = api.sudo();
      await sys.object('sys_audit_log').create(auditRow);
      await sys.object('sys_activity').create(activityRow);
      // M10.8: write per-user inbox notifications. Best-effort; never
      // throws into the user-facing CRUD path. Covers two common cases:
      //
      //   1. Assignment — if owner_id / assigned_to was newly set (or
      //      changed to a different user) on a non-system record, drop
      //      a notification into the recipient's inbox so they can see
      //      "Lead X was assigned to you" without polling the record.
      //
      //   2. (Comment mentions are handled separately by the sys_comment
      //       hook below since SKIP_OBJECTS excludes it from this writer.)
      await writeAssignmentNotifications(sys, {
        object: ctx.object,
        recordId: recordId ?? null,
        label,
        action,
        before,
        after,
        actorId: userId ?? null,
        tenantId: tenantId ?? null,
      });
    } catch (err) {
      // Log via engine logger if available, but never throw.
      try { (engine as any).logger?.warn?.('Audit write failed', { object: ctx.object, action, err: String((err as any)?.message ?? err) }); } catch {}
    }
  };

  engine.registerHook('afterInsert', writeAudit, { packageId });
  engine.registerHook('afterUpdate', writeAudit, { packageId });
  engine.registerHook('afterDelete', writeAudit, { packageId });

  /**
   * M10.8: Dedicated hook on `sys_comment` afterInsert that parses the
   * `mentions` JSON field and writes one sys_notification per mentioned
   * user. Lives outside `writeAudit` because sys_comment is in
   * SKIP_OBJECTS (we don't want audit/activity rows for comments —
   * those have their own first-class feed).
   */
  const writeCommentMentions = async (ctx: HookContext) => {
    if (ctx.object !== 'sys_comment') return;
    if (ctx.event !== 'afterInsert') return;
    const api: any = (ctx as any).api;
    if (!api?.sudo) return;
    const row: any = ctx.result;
    if (!row || typeof row !== 'object') return;

    // mentions is a JSON-string textarea on sys_comment. Accept either
    // a raw array of user-ids ["u1","u2"] or an array of objects
    // [{ id: "u1" }, ...]; tolerate parse failures silently.
    let mentions: any = row.mentions;
    if (typeof mentions === 'string') {
      try { mentions = JSON.parse(mentions); } catch { mentions = null; }
    }
    if (!Array.isArray(mentions) || mentions.length === 0) return;

    const userIds = mentions
      .map((m: any) => (typeof m === 'string' ? m : m?.id))
      .filter((id: any) => typeof id === 'string' && id.length > 0);
    if (userIds.length === 0) return;

    const [source_object, source_id] = String(row.thread_id ?? '').split(':');
    const actorId = row.author_id ?? null;
    const actorName = row.author_name ?? null;
    const bodyPreview = String(row.body ?? '').slice(0, 240);
    const sess: any = (ctx as any).session ?? {};
    const tenantId: string | null = sess.tenantId ?? row.organization_id ?? null;

    const sys = api.sudo();
    for (const uid of userIds) {
      if (uid === actorId) continue; // don't notify the mention author
      try {
        await sys.object('sys_notification').create({
          recipient_id: uid,
          type: 'mention',
          title: actorName ? `${actorName} mentioned you` : 'You were mentioned',
          body: bodyPreview,
          source_object: source_object || null,
          source_id: source_id || null,
          actor_id: actorId,
          actor_name: actorName,
          is_read: false,
          // Stamp tenant so the recipient's RLS sees it (see writeAssignmentNotifications).
          organization_id: tenantId,
        });
      } catch (err) {
        try { (engine as any).logger?.warn?.('Mention notification write failed', { uid, err: String((err as any)?.message ?? err) }); } catch {}
      }
    }
  };
  engine.registerHook('afterInsert', writeCommentMentions, { packageId });
}

/**
 * Identify the assignee/owner field of a record. We accept several
 * conventional names so this works across CRM-style objects (owner_id,
 * assigned_to) and platform objects (recipient_id is handled separately).
 */
const OWNER_FIELDS = ['owner_id', 'assigned_to', 'assignee_id', 'owner', 'assignee'];

function pickOwner(rec: any): string | null {
  if (!rec || typeof rec !== 'object') return null;
  for (const f of OWNER_FIELDS) {
    const v = rec[f];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

async function writeAssignmentNotifications(
  sys: any,
  params: {
    object: string;
    recordId: string | null;
    label: string;
    action: 'create' | 'update' | 'delete';
    before: any;
    after: any;
    actorId: string | null;
    tenantId: string | null;
  },
): Promise<void> {
  if (params.action === 'delete') return;
  if (!params.recordId) return;

  const newOwner = pickOwner(params.after);
  const oldOwner = pickOwner(params.before);
  if (!newOwner) return;
  if (params.action === 'update' && newOwner === oldOwner) return;
  if (newOwner === params.actorId) return; // self-assignment is silent

  try {
    await sys.object('sys_notification').create({
      recipient_id: newOwner,
      type: 'assignment',
      title: `${params.object} "${params.label}" assigned to you`,
      body: null,
      source_object: params.object,
      source_id: params.recordId,
      actor_id: params.actorId,
      actor_name: null,
      is_read: false,
      // Stamp organization_id so the recipient (who lives in the same
      // tenant as the action) sees the notification through RLS. Without
      // this, sys_notification rows insert with NULL organization_id and
      // the recipient's `tenant_isolation` policy denies them.
      organization_id: params.tenantId,
    });
  } catch {
    // best-effort; never throw into CRUD path
  }
}

// Re-export for convenience.
export type { IDataEngine };

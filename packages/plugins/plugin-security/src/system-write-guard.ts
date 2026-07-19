// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0103 — engine-owned write guard for the `system` / `append-only` buckets.
 *
 * `managedBy: 'system'` and `managedBy: 'append-only'` default to *engine-owned*:
 * rows a platform service owns end to end (the approval engine, the sharing
 * engine, the job runner, the messaging pipeline, …), written only via
 * `isSystem` / a service `SYSTEM_CTX` / a context-less engine call. Until this
 * guard that promise was enforced by nothing but UI affordances and default
 * permission sets — a wildcard admin could raw-write these rows through the
 * generic data API (ADR-0049 violation), exactly the hole ADR-0092's identity
 * write guard closed for `better-auth`.
 *
 * This is the `system`/`append-only` counterpart, keyed off the SAME contract
 * the UI and the `apiMethods` reconciliation use — {@link resolveCrudAffordances}
 * — rather than the raw bucket string. An object is engine-owned precisely when
 * its resolved affordances grant no write; the admin/user-writable members of
 * these buckets (the RBAC link tables, `sys_user_preference`, the messaging
 * config grids, …) declare `userActions` opening the verbs they legitimately
 * take, so they pass this guard and their real authz — the `DelegatedAdminGate`,
 * RLS self-grants, permission sets — adjudicates the principal, unchanged.
 *
 * A write is USER-CONTEXT when its context carries a real `userId` and is not
 * `isSystem`. `isSystem` and context-less engine/service writes bypass by
 * construction — that is exactly how the legitimate engine writers reach these
 * tables (the messaging service's raw-engine writes carry no session; the
 * metadata-protocol repository threads only a transaction handle; approval /
 * job / sharing services stamp `SYSTEM_CTX`).
 *
 * Denials raise {@link PermissionDeniedError} (HTTP 403), the same sentinel the
 * rest of `SecurityPlugin` throws. `better-auth` is deliberately NOT handled
 * here — it keeps plugin-auth's identity write guard, whose field-whitelist and
 * session-snapshot-refresh semantics differ.
 */

import { resolveCrudAffordances } from '@objectstack/spec/data';
import { PermissionDeniedError } from './errors.js';

/** Buckets whose DEFAULT affordance row is engine-owned (no user writes). */
export const ENGINE_OWNED_BUCKETS: ReadonlySet<string> = new Set(['system', 'append-only']);

/**
 * Engine write operation → the {@link resolveCrudAffordances} flag it needs.
 * Read ops (`find`/`findOne`/`count`/`aggregate`/…) are absent and always pass.
 * Aligned with the `DelegatedAdminGate` governed-operation set and the registry's
 * `MANAGED_WRITE_VERB_AFFORDANCE`.
 */
const WRITE_OP_AFFORDANCE: Record<string, 'create' | 'edit' | 'delete'> = {
  insert: 'create',
  update: 'edit',
  upsert: 'edit',
  transfer: 'edit',
  delete: 'delete',
  purge: 'delete',
  restore: 'delete',
};

/** Minimal shape read off a registered schema. */
export interface EngineOwnedSchemaLike {
  name?: string;
  managedBy?: string;
  userActions?: unknown;
}

/**
 * A write is user-context when it carries a real user and is not system
 * elevated. Context-less engine calls (no session) and `isSystem` plugin/system
 * writes both bypass by construction.
 */
function isUserContextWrite(context: any): boolean {
  return Boolean(context?.userId) && context?.isSystem !== true;
}

/**
 * Fail-closed on a user-context generic write to an engine-owned
 * `system`/`append-only` object. No-op for: reads, non-engine-owned buckets,
 * system/context-less writes, and objects whose `userActions` open the verb.
 *
 * @param schema     the registered schema (or undefined — unknown objects pass)
 * @param operation  the engine operation (`insert`/`update`/`delete`/…)
 * @param context    the operation execution context
 */
export function assertEngineOwnedWriteAllowed(
  schema: EngineOwnedSchemaLike | undefined | null,
  operation: string,
  context: any,
): void {
  const bucket = schema?.managedBy;
  if (!bucket || !ENGINE_OWNED_BUCKETS.has(bucket)) return;

  const need = WRITE_OP_AFFORDANCE[operation];
  if (!need) return; // read / non-write op

  if (!isUserContextWrite(context)) return; // isSystem or context-less → bypass

  const affordances = resolveCrudAffordances(schema as any);
  if (affordances[need]) return; // userActions opened it → writable set

  throw new PermissionDeniedError(
    `[Security] Access denied: '${schema?.name ?? 'object'}' is engine-owned ` +
      `(managedBy:'${bucket}', ADR-0103) — direct ${operation} via the data API is disabled. ` +
      `These rows are written only by their owning platform service; interact via the ` +
      `object's domain actions instead.`,
    { operation, object: schema?.name, managedBy: bucket },
  );
}

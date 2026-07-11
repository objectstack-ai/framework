// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Identity bulk import — `POST /api/v1/auth/admin/import-users` (#2766 V2,
 * re-scoped from #2758).
 *
 * Why a dedicated endpoint instead of opening sys_user's generic import
 * affordance: the generic `/data/:object/import` path writes rows straight
 * through ObjectQL, which would bypass better-auth's password hashing and
 * never create the `sys_account` credential row — every "imported user" would
 * be a dead row that can never sign in. This endpoint reuses the generic
 * import *framework* (payload parsing via `prepareImportRequest`, the row
 * engine via `runImport`) but swaps the write path for an identity-specific
 * `ImportProtocolLike` whose `createData` drives `auth.api.createUser`.
 *
 * Password policies:
 *  - `none`       — THE DEFAULT. No password is set at all: better-auth
 *                   creates the account without a credential record, and the
 *                   user's first sign-in is channel-based (phone OTP, magic
 *                   link, or an email reset link). The Console already
 *                   detects credential-less accounts (`hasLocalPassword()`)
 *                   and offers `set-initial-password`, so users are nudged to
 *                   set a password after their first OTP sign-in. Import's
 *                   job is identity — credentials are the auth domain's.
 *  - `invite`     — like `none` (credential-less creation; better-auth's
 *                   reset-password creates the credential account on first
 *                   set), plus a "set your password" invitation goes out per
 *                   created account: a reset-password email for rows with a
 *                   REAL email (requires a wired EmailService), or — #2780 —
 *                   an invitation SMS for phone-only rows (requires a wired,
 *                   deliverable SmsService + the phoneNumber plugin; the user
 *                   first signs in via phone OTP and then sets a password).
 *                   Rows are validated per-channel reachability.
 *  - `temporary`  — the no-infrastructure fallback (no email, no SMS): each
 *                   created account gets a generated temporary password,
 *                   `must_change_password` is stamped (403 PASSWORD_EXPIRED
 *                   until changed), and the passwords are returned ONCE in the
 *                   HTTP response, one per row. Never persisted, never logged.
 *
 * Deliberate limits:
 *  - Synchronous only, ≤ IMPORT_USERS_MAX_ROWS rows per request. scrypt
 *    hashing costs ~100ms/row, so bigger batches belong in an async job —
 *    which can't carry temporary passwords anyway (a job result is a
 *    persistence surface; red line). Callers split large files into batches.
 *  - No undo. Undoing an identity import would bulk-delete users and their
 *    credentials — the risk dwarfs the convenience.
 *  - Upsert updates only touch profile fields (UPDATE_ALLOWED_FIELDS);
 *    credentials and the email identity are never modified on update, so a
 *    re-imported CSV can never silently reset an existing user's password.
 */

import type {
  PreparedImport,
  ImportProtocolLike,
  ImportRowResult,
} from '@objectstack/rest';
import { prepareImportRequest, runImport } from '@objectstack/rest';
import { generatePlaceholderEmail, isPlaceholderEmail } from './placeholder-email.js';
import { generateTemporaryPassword, normalizePhoneNumber, isLikelyEmail, type AdminActor, type EndpointResult } from './admin-user-endpoints.js';
import { SYS_USER_IMPORT_UPDATE_FIELDS } from './sys-user-writable-fields.js';

export const IMPORT_USERS_MAX_ROWS = 500;

/**
 * Profile fields an upsert row may modify on an EXISTING user — shared with
 * the identity write guard's Tier-1 whitelist via sys-user-writable-fields.ts
 * (ADR-0092 D3: one file, one derivation; the import surface is a strict
 * superset that additionally allows `phone_number` / `role`).
 */
const UPDATE_ALLOWED_FIELDS = SYS_USER_IMPORT_UPDATE_FIELDS;

export interface IdentityImportEngine {
  find(objectName: string, query?: any): Promise<any[]>;
  update(objectName: string, data: any, options?: any): Promise<any>;
  insert(objectName: string, data: any, options?: any): Promise<any>;
}

export interface IdentityImportDeps {
  /** better-auth server api (createUser + requestPasswordReset). */
  getAuthApi(): Promise<any>;
  getDataEngine(): IdentityImportEngine | undefined;
  /** Optional metadata reader for field coercion (best-effort). */
  getMetaItem?(ref: { type: string; name: string }): Promise<any>;
  phoneNumberEnabled(): boolean;
  emailServiceAvailable(): boolean;
  /**
   * #2780 — can phone-only rows take the SMS-invite path? True when the
   * phoneNumber plugin is on AND a deliverable SMS service is wired (the
   * user must be able to complete phone-OTP first sign-in).
   */
  smsInviteAvailable(): boolean;
  /** #2780 — deliver the invitation SMS (no credential in the message). */
  sendInviteSms(phone: string): Promise<void>;
  noteMustChangePasswordIssued(): void;
  logger?: { warn(msg: string): void };
}

const SYSTEM_CTX = { isSystem: true, positions: [], permissions: [] };

interface RowIdentity {
  email?: string;
  phone?: string;
  invalid?: { code: string; error: string };
}

/**
 * Resolve a raw row's identity columns. Accepts `email` plus any of
 * `phone_number` / `phoneNumber` / `phone` for the phone column (normalized
 * in place to `phone_number`).
 */
function resolveRowIdentity(
  row: Record<string, any>,
  opts: {
    policy: 'none' | 'invite' | 'temporary';
    phoneEnabled: boolean;
    emailInviteOk: boolean;
    smsInviteOk: boolean;
  },
): RowIdentity {
  const rawEmail = typeof row.email === 'string' ? row.email.trim() : '';
  const hasEmail = rawEmail.length > 0;
  if (hasEmail && !isLikelyEmail(rawEmail)) {
    return { invalid: { code: 'INVALID_EMAIL', error: `"${rawEmail}" is not a valid email` } };
  }
  if (hasEmail && isPlaceholderEmail(rawEmail)) {
    return { invalid: { code: 'INVALID_EMAIL', error: 'Placeholder addresses cannot be imported as emails' } };
  }

  const rawPhone = row.phone_number ?? row.phoneNumber ?? row.phone;
  const hasPhone = typeof rawPhone === 'string' && rawPhone.trim().length > 0;
  let phone: string | undefined;
  if (hasPhone) {
    if (!opts.phoneEnabled) {
      return { invalid: { code: 'PHONE_NOT_ENABLED', error: 'Phone columns require the phoneNumber auth plugin (auth.plugins.phoneNumber)' } };
    }
    phone = normalizePhoneNumber(String(rawPhone));
    if (!phone) {
      return { invalid: { code: 'INVALID_PHONE', error: `"${rawPhone}" is not a valid phone number (E.164 recommended)` } };
    }
  }

  if (!hasEmail && !phone) {
    return { invalid: { code: 'NO_IDENTITY', error: 'Row needs an email or a phone_number' } };
  }
  if (opts.policy === 'invite') {
    // Every invite row must be REACHABLE through a wired channel: email rows
    // need the email service, phone-only rows the SMS-invite path (#2780).
    // Validated per row so a mixed file fails only the rows it must.
    if (hasEmail && !opts.emailInviteOk) {
      return {
        invalid: {
          code: 'EMAIL_SERVICE_REQUIRED',
          error: 'This row\'s invitation needs a configured email service — wire an EmailService or use the temporary policy',
        },
      };
    }
    if (!hasEmail && !opts.smsInviteOk) {
      return {
        invalid: {
          code: 'INVITE_REQUIRES_EMAIL',
          error: 'The invite policy needs a real email for this row — configure SMS delivery (phone OTP) for SMS invitations, or use the temporary policy',
        },
      };
    }
  }
  return { email: hasEmail ? rawEmail.toLowerCase() : undefined, phone };
}

export async function runAdminImportUsers(
  deps: IdentityImportDeps,
  request: Request,
  actor: AdminActor,
): Promise<EndpointResult> {
  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }
  const fail = (status: number, code: string, message: string): EndpointResult => ({
    status, body: { success: false, error: { code, message } },
  });

  // ── Request-level validation ─────────────────────────────────────────
  // Default policy: `none` — import provisions identity, not credentials.
  // Users first sign in via a channel (phone OTP / magic link / reset link)
  // and the Console's hasLocalPassword() flow nudges them to set a password.
  const policy = body?.passwordPolicy === undefined ? 'none' : body.passwordPolicy;
  if (policy !== 'none' && policy !== 'invite' && policy !== 'temporary') {
    return fail(400, 'invalid_request', 'passwordPolicy must be "none" (default), "invite", or "temporary"');
  }
  const mode = body?.mode === 'upsert' ? 'upsert' : body?.mode === 'insert' || body?.mode === undefined ? 'insert' : undefined;
  if (!mode) return fail(400, 'invalid_request', 'mode must be "insert" or "upsert"');
  const matchBy = body?.matchBy === 'phone' ? 'phone' : body?.matchBy === 'email' || body?.matchBy === undefined ? 'email' : undefined;
  if (!matchBy) return fail(400, 'invalid_request', 'matchBy must be "email" or "phone"');
  if (matchBy === 'phone' && !deps.phoneNumberEnabled()) {
    return fail(400, 'PHONE_NOT_ENABLED', 'matchBy "phone" requires the phoneNumber auth plugin (auth.plugins.phoneNumber)');
  }
  const emailInviteOk = deps.emailServiceAvailable();
  const smsInviteOk = deps.smsInviteAvailable();
  if (policy === 'invite' && !emailInviteOk && !smsInviteOk) {
    // Reject up front — otherwise N accounts get created whose invitations
    // all fail (and outside dev we refuse to log the reset links). With at
    // least one channel wired, per-row validation covers the rest.
    return fail(400, 'EMAIL_SERVICE_REQUIRED', 'The invite policy requires a configured email service (or SMS delivery for phone-only rows). Use the temporary policy or wire an EmailService / SmsService.');
  }
  if (body?.async === true) {
    // Async jobs are a persistence surface — they can't carry temporary
    // passwords (red line), and the invite flow at job scale needs the shared
    // job worker. Tracked as a follow-up; batches of ≤500 cover the V2 need.
    return fail(400, 'ASYNC_NOT_SUPPORTED', `Async identity import is not supported yet — split the file into batches of at most ${IMPORT_USERS_MAX_ROWS} rows.`);
  }

  const engine = deps.getDataEngine();
  if (!engine) return fail(503, 'unavailable', 'Data engine unavailable');

  // ── Payload parsing (shared generic-import parser) ───────────────────
  const prep = await prepareImportRequest(
    {
      ...body,
      writeMode: mode,
      matchFields: [matchBy === 'phone' ? 'phone_number' : 'email'],
      runAutomations: false,
      // Identity semantics: a row whose match key is blank must never
      // fall through to "create a second account" on upsert.
      skipBlankMatchKey: true,
    },
    {
      p: { ...(deps.getMetaItem ? { getMetaItem: deps.getMetaItem } : {}) },
      objectName: 'sys_user',
      maxRows: IMPORT_USERS_MAX_ROWS,
    },
  );
  if (!prep.ok) return fail(prep.status, prep.code, prep.error);
  const prepared: PreparedImport = prep.prepared;

  // ── Identity pre-validation (runs for dryRun too) ────────────────────
  const phoneEnabled = deps.phoneNumberEnabled();
  const results: Array<ImportRowResult & { temporaryPassword?: string }> = new Array(prepared.rows.length);
  const validRows: Array<Record<string, any>> = [];
  const validIndex: number[] = [];
  for (let i = 0; i < prepared.rows.length; i++) {
    const row = { ...prepared.rows[i] };
    const identity = resolveRowIdentity(row, { policy, phoneEnabled, emailInviteOk, smsInviteOk });
    if (identity.invalid) {
      results[i] = { row: i + 1, ok: false, action: 'failed', code: identity.invalid.code, error: identity.invalid.error };
      continue;
    }
    // Canonicalize the identity columns for coercion + match lookups.
    delete row.phoneNumber; delete row.phone;
    if (identity.email) row.email = identity.email; else delete row.email;
    if (identity.phone) row.phone_number = identity.phone; else delete row.phone_number;
    validRows.push(row);
    validIndex.push(i);
  }

  // ── Identity write protocol (the part generic import must NOT do) ────
  const temporaryPasswords = new Map<string, string>(); // record id → temp password
  const createdEmails = new Map<string, { email: string; placeholder: boolean; phone?: string }>();
  const authApi = await deps.getAuthApi();
  if (typeof authApi.createUser !== 'function') {
    return fail(501, 'not_supported', 'The better-auth admin plugin is not enabled (auth.plugins.admin)');
  }

  const protocol: ImportProtocolLike = {
    // findExisting path: `{ $filter, $top }` against sys_user.
    async findData(args: any) {
      const where = args?.query?.$filter ?? {};
      const limit = args?.query?.$top ?? 2;
      return engine.find(args.object, { where, limit, context: SYSTEM_CTX } as any);
    },

    // One better-auth create per row — hashing + credential sys_account.
    // Deliberately NO createManyData: there is no safe bulk primitive for
    // identities, and scrypt dominates the cost anyway.
    async createData(args: any) {
      const data: Record<string, any> = args?.data ?? {};
      const email: string = typeof data.email === 'string' && data.email.length > 0
        ? data.email
        : generatePlaceholderEmail(); // phone-only rows (none/temporary, or invite via SMS)
      const placeholder = !(typeof data.email === 'string' && data.email.length > 0);
      const phone: string | undefined = typeof data.phone_number === 'string' && data.phone_number.length > 0 ? data.phone_number : undefined;
      const name: string = typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name.trim()
        : placeholder ? (phone as string) : email.split('@')[0];
      const role: string | undefined = typeof data.role === 'string' && data.role.length > 0 ? data.role : undefined;

      // Only the `temporary` policy sets a password. `none`/`invite` create
      // credential-less accounts (better-auth: omitted password → no
      // credential record); the credential is minted later by the user via
      // set-initial-password / the reset flow, which creates it on demand.
      const password = policy === 'temporary' ? generateTemporaryPassword() : undefined;

      const created = await authApi.createUser({
        body: {
          email,
          name,
          ...(password ? { password } : {}),
          ...(role ? { role } : {}),
          ...(phone ? { data: { phoneNumber: phone } } : {}),
        },
      });
      const id = created?.user?.id != null ? String(created.user.id) : undefined;
      if (!id) throw Object.assign(new Error('better-auth returned no user id'), { code: 'CREATE_FAILED' });

      if (policy === 'temporary') {
        temporaryPasswords.set(id, password as string);
        try {
          await engine.update('sys_user', { id, must_change_password: true }, { context: SYSTEM_CTX } as any);
          deps.noteMustChangePasswordIssued();
        } catch (e) {
          deps.logger?.warn(`[AuthPlugin] import-users: failed to stamp must_change_password for ${id}: ${(e as Error)?.message ?? e}`);
        }
      } else if (policy === 'invite') {
        createdEmails.set(id, { email, placeholder, ...(phone ? { phone } : {}) });
      }
      // `none`: nothing else to do — identity only.
      return { id };
    },

    // Upsert updates touch PROFILE fields only — never email, never anything
    // credential- or system-managed. An empty filtered patch is a no-op.
    async updateData(args: any) {
      const patch: Record<string, any> = {};
      for (const [k, v] of Object.entries(args?.data ?? {})) {
        if (UPDATE_ALLOWED_FIELDS.has(k) && v !== undefined && v !== null && v !== '') patch[k] = v;
      }
      if (Object.keys(patch).length === 0) return { id: args.id };
      await engine.update('sys_user', { id: args.id, ...patch }, { context: SYSTEM_CTX } as any);
      return { id: args.id };
    },
  };

  // ── Run the shared row engine over the valid rows ─────────────────────
  const summary = await runImport({
    p: protocol,
    objectName: 'sys_user',
    rows: validRows,
    metaMap: prepared.metaMap,
    writeMode: prepared.writeMode,
    matchFields: prepared.matchFields,
    dryRun: prepared.dryRun,
    runAutomations: false,
    trimWhitespace: prepared.trimWhitespace,
    nullValues: prepared.nullValues,
    createMissingOptions: false,
    skipBlankMatchKey: true,
    captureUndo: false, // undo = bulk-deleting users; deliberately unsupported
  });

  // Re-map engine results onto the original row numbering.
  let preErrors = 0;
  for (const r of results) if (r) preErrors++;
  for (let j = 0; j < summary.results.length; j++) {
    const original = validIndex[j];
    const r = summary.results[j];
    results[original] = { ...r, row: original + 1 };
  }

  // ── Post-write phases (skipped on dryRun) ─────────────────────────────
  if (!prepared.dryRun) {
    // invite: send a set-your-password invitation per created account —
    // a reset-password email for real-email rows, an invitation SMS for
    // phone-only (placeholder-email) rows (#2780). The SMS carries no
    // credential: the user requests their own OTP at first sign-in, which
    // keeps the placeholder-email interception logic fully aligned (the
    // placeholder address itself is never a delivery target on any channel).
    if (policy === 'invite') {
      for (const r of results) {
        if (!r || r.action !== 'created' || !r.id) continue;
        const target = createdEmails.get(r.id);
        if (!target) continue;
        if (target.placeholder) {
          if (!target.phone) continue; // defensive — placeholder rows were validated to carry a phone
          try {
            await deps.sendInviteSms(target.phone);
          } catch (e) {
            // The account exists; only the SMS failed. Not a rollback —
            // remediation is re-sending or an admin set-user-password.
            r.code = 'INVITE_SMS_FAILED';
            r.error = `User created, but the invitation SMS failed: ${((e as Error)?.message ?? String(e)).slice(0, 200)}`;
          }
          continue;
        }
        try {
          await authApi.requestPasswordReset({ body: { email: target.email } });
        } catch (e) {
          // The account exists; only the email failed. Not a rollback —
          // remediation is re-sending or an admin set-user-password.
          r.code = 'INVITE_EMAIL_FAILED';
          r.error = `User created, but the invitation email failed: ${((e as Error)?.message ?? String(e)).slice(0, 200)}`;
        }
      }
    }
    // temporary: attach each password to its row — response body ONLY.
    if (policy === 'temporary') {
      for (const r of results) {
        if (r?.action === 'created' && r.id && temporaryPasswords.has(r.id)) {
          r.temporaryPassword = temporaryPasswords.get(r.id);
        }
      }
    }

    // Run-level audit (better-auth writes bypass the ObjectQL hooks that
    // plugin-audit subscribes to). Best-effort; NO password material.
    try {
      await engine.insert('sys_audit_log', {
        action: 'import',
        user_id: actor.id,
        actor: actor.id,
        object_name: 'sys_user',
        metadata: JSON.stringify({
          event: 'user.import_run',
          mode, matchBy, passwordPolicy: policy,
          total: prepared.rows.length,
          created: summary.created, updated: summary.updated,
          skipped: summary.skipped, errors: summary.errors + preErrors,
        }),
      }, { context: SYSTEM_CTX } as any);
    } catch { /* audit table may not exist — never fail the import */ }
  }

  const errors = summary.errors + preErrors;
  return {
    status: 200,
    body: {
      success: true,
      data: {
        summary: {
          total: prepared.rows.length,
          created: summary.created,
          updated: summary.updated,
          skipped: summary.skipped,
          errors,
          dryRun: prepared.dryRun,
          passwordPolicy: policy,
          mode,
          matchBy,
        },
        rows: results,
      },
    },
  };
}

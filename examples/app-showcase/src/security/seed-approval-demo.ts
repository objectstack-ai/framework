// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Approval demo bootstrap — makes the marquee v16 approval features
 * (M-of-N quorum + per-group 会签, server-computed progress, decision
 * attachments, `?request=` deep links, viewer gating, the reassign picker)
 * demonstrable on a FRESH boot, with no manual setup.
 *
 * Why this exists (and can't be a seed):
 *  - The `approval` flow nodes route to `{ type: 'position', value: 'finance' |
 *    'legal' | 'manager' }`. Approver resolution reads `sys_user_position`
 *    (ADR-0090 D3), but users can't be seeded (they sign up) and position
 *    assignments are runtime admin actions — so out of the box NO ONE holds
 *    those positions and every request resolves to an empty slate and waits
 *    forever.
 *  - The seed loader SUPPRESSES record-change flows (#2661), so seeding an
 *    invoice as `sent` (or an expense as `submitted`) never opens a request.
 *  - `sys_approval_request` is engine-owned (ADR-0103: get/list only), so a
 *    request can't be inserted through the generic data API either.
 *
 * So we play the admin's part imperatively, exactly like `bind-position-sets.ts`:
 * on `kernel:bootstrapped` (after the security bootstrap has created the
 * position/permission rows and the automation engine is wired) we
 *   1. assign the dev-seeded admin to `manager` / `finance` / `legal` so they
 *      are a resolvable approver on every demo request (and can act in the
 *      inbox);
 *   2. provision a phone-based demo user so the "phone sign-in surfaces" show
 *      a real number in the All Users list + record detail;
 *   3. launch the Invoice Dual Sign-off (finance ∧ legal — 会签) and the
 *      High-Value Committee Quorum (2-of-3) flows through the real automation
 *      engine, so genuine, resumable pending requests land in the inbox.
 *
 * Everything is idempotent: a persistent DB keeps the assignments/requests, and
 * `openNodeRequest` rejects a duplicate pending request per (object, record),
 * which we swallow.
 */

const SYS = { isSystem: true } as const;

const ADMIN_EMAIL = 'admin@objectos.ai';

/** Positions the admin is granted so they resolve as an approver on the demos. */
const ADMIN_APPROVAL_POSITIONS = ['manager', 'finance', 'legal'] as const;

/** A phone-based demo persona (§6 "phone sign-in surfaces"). */
const PHONE_DEMO_USER = {
  id: 'usr_showcase_phone_demo',
  name: 'Mei Phone (demo)',
  email: 'phone.demo@example.com',
  phone_number: '+8613800138000',
} as const;

interface ApprovalDemoContext {
  ql: {
    find: (object: string, query: unknown, options?: unknown) => Promise<unknown>;
    insert: (object: string, data: Record<string, unknown>, options?: unknown) => Promise<unknown>;
  };
  getService?: <T = unknown>(name: string) => Promise<T>;
  logger?: { info?: (...a: unknown[]) => void; warn?: (...a: unknown[]) => void };
  hook?: (event: string, handler: () => Promise<void> | void) => void;
}

/** Minimal shape of the automation engine we drive (see service-automation). */
interface AutomationEngineLike {
  execute: (
    flowName: string,
    context?: { record?: unknown; previous?: unknown; object?: string; organizationId?: string | null; [k: string]: unknown },
  ) => Promise<{ success?: boolean; error?: string; output?: unknown } | unknown>;
}

function asRows(res: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
  const r = res as { records?: unknown[] } | null;
  return (r?.records as Array<Record<string, unknown>>) ?? [];
}

async function findOne(
  ctx: ApprovalDemoContext,
  object: string,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  try {
    const rows = asRows(await ctx.ql.find(object, { where, limit: 1, context: SYS }));
    return rows[0];
  } catch (err) {
    ctx.logger?.warn?.('[showcase] approval-demo lookup failed', {
      object,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/** Grant the admin the approval-routing positions (idempotent by stable id). */
async function assignAdminPositions(
  ctx: ApprovalDemoContext,
  adminId: string,
  organizationId: string | null,
): Promise<void> {
  for (const position of ADMIN_APPROVAL_POSITIONS) {
    const existing = await findOne(ctx, 'sys_user_position', {
      user_id: adminId,
      position,
      ...(organizationId ? { organization_id: organizationId } : {}),
    });
    if (existing) continue;
    try {
      await ctx.ql.insert(
        'sys_user_position',
        {
          id: `usp_showcase_admin_${position}`,
          user_id: adminId,
          position,
          ...(organizationId ? { organization_id: organizationId } : {}),
          reason: 'Showcase approval demo — admin holds every approver position so requests are actionable.',
        },
        { context: SYS },
      );
    } catch (err) {
      ctx.logger?.warn?.('[showcase] approval-demo position assign failed', {
        position,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** Provision a phone-based demo user (best-effort; renders the phone surfaces). */
async function ensurePhoneDemoUser(ctx: ApprovalDemoContext): Promise<void> {
  const existing = await findOne(ctx, 'sys_user', { email: PHONE_DEMO_USER.email });
  if (existing) return;
  try {
    // `sys_user` carries NO org column — org membership lives on `sys_member`
    // (see the resolution in `run` below). An `organization_id` key here is not
    // silently dropped: it reaches SQL as a real column and the insert dies with
    // "table sys_user has no column named organization_id", so the demo user is
    // never provisioned and the phone surfaces render empty.
    await ctx.ql.insert('sys_user', { ...PHONE_DEMO_USER }, { context: SYS });
    ctx.logger?.info?.('[showcase] approval-demo phone user provisioned', { email: PHONE_DEMO_USER.email });
  } catch (err) {
    // Non-fatal: sign-in still needs a better-auth account; this row just makes
    // the phone number visible in the All Users list + record detail.
    ctx.logger?.warn?.('[showcase] approval-demo phone user insert failed (surfaces only)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Launch a signoff flow on a record through the real automation engine, unless
 * a pending request already exists for it.
 */
async function launchSignoff(
  ctx: ApprovalDemoContext,
  engine: AutomationEngineLike,
  flowName: string,
  objectName: string,
  record: Record<string, unknown>,
  organizationId: string | null,
  /**
   * The record's status BEFORE it entered the trigger state, supplied as
   * `context.previous` so the start-node transition gate — e.g.
   * `status == "sent" && previous.status != "sent"` — is satisfied. The engine
   * only binds `previous` when the caller provides it (engine.ts), and a
   * record-change trigger normally would; an explicit launch must too, or the
   * start condition silently evaluates false and no request opens.
   */
  previousStatus: string,
): Promise<void> {
  const recordId = String(record.id ?? '');
  if (!recordId) return;
  const pending = await findOne(ctx, 'sys_approval_request', {
    object_name: objectName,
    record_id: recordId,
    status: 'pending',
  });
  if (pending) {
    ctx.logger?.info?.('[showcase] approval-demo request already pending', { flow: flowName, record: recordId });
    return;
  }
  try {
    // The `object` + `organizationId` on the context are what a record-change
    // trigger supplies; the approval node reads `context.object` for its target
    // (approval-node.ts) and stamps the request's org from `context.organizationId`.
    const result = (await engine.execute(flowName, {
      record,
      previous: { ...record, status: previousStatus },
      object: objectName,
      organizationId,
    })) as { success?: boolean; error?: string; output?: { skipped?: boolean; reason?: string } };
    if (result?.success === false) {
      ctx.logger?.warn?.('[showcase] approval-demo flow returned an error', { flow: flowName, error: result.error });
    } else if (result?.output?.skipped) {
      ctx.logger?.warn?.('[showcase] approval-demo flow skipped (start condition not met)', {
        flow: flowName, reason: result.output.reason,
      });
    } else {
      ctx.logger?.info?.('[showcase] approval-demo launched', { flow: flowName, object: objectName, record: recordId });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('DUPLICATE_REQUEST')) return; // raced another launcher — fine
    ctx.logger?.warn?.('[showcase] approval-demo flow launch failed', { flow: flowName, error: msg });
  }
}

export function registerShowcaseApprovalDemo(ctx: ApprovalDemoContext): void {
  const run = async (): Promise<void> => {
    const admin = await findOne(ctx, 'sys_user', { email: ADMIN_EMAIL });
    if (!admin?.id) {
      // No dev-seeded admin (e.g. a real deployment) — nothing to demo against.
      ctx.logger?.info?.('[showcase] approval-demo skipped (no dev admin)');
      return;
    }
    const adminId = String(admin.id);
    // The active org lives on the better-auth membership (`sys_member`).
    // `sys_user` has no org column at all, so there is nothing to read off the
    // admin row first. Both the position rows AND the requests must carry this
    // org, or the org-scoped approver resolution (`sys_user_position` filtered
    // by org) and `getRequest` (the org-scoped read behind the inbox drawer)
    // silently return nothing.
    const ownerMember = await findOne(ctx, 'sys_member', { user_id: adminId, role: 'owner' });
    const anyMember = ownerMember ?? (await findOne(ctx, 'sys_member', { user_id: adminId }));
    const organizationId = (anyMember?.organization_id as string | undefined) ?? null;

    await assignAdminPositions(ctx, adminId, organizationId);
    await ensurePhoneDemoUser(ctx);

    let engine: AutomationEngineLike | undefined;
    try {
      engine = await ctx.getService?.<AutomationEngineLike>('automation');
    } catch {
      engine = undefined;
    }
    if (!engine || typeof engine.execute !== 'function') {
      ctx.logger?.warn?.('[showcase] approval-demo: automation engine unavailable — requests not opened');
      return;
    }

    // 会签 (per_group): Invoice Dual Sign-off needs a `sent` invoice; the start
    // gate is `status == "sent" && previous.status != "sent"`, so it entered
    // from `draft`.
    const sentInvoice = await findOne(ctx, 'showcase_invoice', { status: 'sent' });
    if (sentInvoice) {
      await launchSignoff(ctx, engine, 'showcase_invoice_signoff', 'showcase_invoice', sentInvoice, organizationId, 'draft');
    }

    // Quorum (2-of-3): High-Value Committee needs a `submitted` report ≥ $5000;
    // the start gate is `status == "submitted" && previous.status != "submitted"
    // && total_amount >= 5000`, so it entered from `draft`.
    const demoExpense = await findOne(ctx, 'showcase_expense_report', { name: 'EXP-DEMO' });
    if (demoExpense) {
      await launchSignoff(ctx, engine, 'showcase_committee_quorum', 'showcase_expense_report', demoExpense, organizationId, 'draft');
    }
  };

  if (typeof ctx.hook === 'function') {
    // `kernel:bootstrapped` — after every `kernel:ready` handler (the security
    // bootstrap that seeds positions, and the automation engine wiring) has
    // settled, so lookups resolve and the engine is ready.
    ctx.hook('kernel:bootstrapped', run);
  } else {
    setTimeout(() => void run(), 0);
  }
}

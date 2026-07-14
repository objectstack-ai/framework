// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// ── Unit-layer authorization matrix gate (ADR-0095 Sequencing step 0) ───────
//
// ADR-0095 makes tenant isolation a behavior-preserving-by-contract refactor:
// every step lands behind a `role × object × expected-visible-rows` snapshot,
// and any delta the snapshot exposes is a bug to chase — with ONE deliberate
// exception (the W1 cross-tenant read fix). The existing conformance matrix
// (`packages/dogfood/test/authz-conformance.matrix.ts`) proves this end-to-end
// through a real app boot (minutes). This file is the UNIT-LAYER equivalent so
// the extraction loop is seconds: it drives the real SecurityPlugin CRUD
// middleware with the real seeded permission sets and snapshots the *effective
// RLS filter* each (role × object × operation) cell produces.
//
// The "expected-visible-rows" semantics are encoded as the compiled filter that
// the engine would AND onto the query (read path) or verify the target row
// against (by-id write pre-image). Two filters that select the same rows are the
// same visibility; the snapshot is that filter, verbatim.
//
// This file adds NO production code. It LOCKS current behavior — including the
// two structural weaknesses ADR-0095 closes (W1 read leak, and its write-side
// twin: `owner_only_writes` defeated by the tenant OR-merge) — so that when Layer
// 0 (D1) is extracted, exactly those cells flip and nothing else moves.

import { describe, it, expect, vi } from 'vitest';
import { SecurityPlugin } from './security-plugin.js';
import { defaultPermissionSets } from './objects/default-permission-sets.js';
import { RLS_DENY_FILTER } from './rls-compiler.js';
import type { PermissionSet } from '@objectstack/spec/security';

// A permissive, admin-authored business RLS policy (ADR-0095 W1's worked
// example): "everyone may read rows whose status is public". At the RLS layer
// this is OR-merged with the wildcard tenant policy today — so it is, by itself,
// sufficient to admit a row from ANOTHER organization. Modeled here as a custom
// set because W1 is about ANY permissive business policy, not a seeded one.
const publicReader: PermissionSet = {
  name: 'public_reader',
  label: 'Public Reader (permissive business RLS)',
  objects: { '*': { allowRead: true, allowCreate: true, allowEdit: true } },
  rowLevelSecurity: [
    { name: 'public_read', object: '*', operation: 'select', using: "status == 'public'" },
  ],
} as any;

const ALL_SETS: PermissionSet[] = [...defaultPermissionSets, publicReader];
const DENY = RLS_DENY_FILTER.id; // the fail-closed sentinel's marker value

// ── Minimal middleware harness ──────────────────────────────────────────────
// Drives the REAL security CRUD middleware against a single-object schema whose
// posture (public / private / tenancy-disabled / better-auth-managed) and field
// set are configurable, so one helper covers the whole object axis.
function makeHarness(opts: {
  objectName: string;
  objectFields: string[];
  schemaExtra?: Record<string, any>;
  orgScoping?: boolean;
  findOneImpl?: (q: any) => any;
}) {
  const fields: Record<string, any> = {};
  for (const f of opts.objectFields) fields[f] = { name: f };
  const baseSchema: any = { name: opts.objectName, fields, ...(opts.schemaExtra ?? {}) };
  let middleware: any;
  const findOne = vi.fn(async (_o: string, q: any) => (opts.findOneImpl ? opts.findOneImpl(q) : null));
  const ql = {
    registerMiddleware: (mw: any) => { if (!middleware) middleware = mw; },
    getSchema: () => baseSchema,
    findOne,
  };
  const metadata = { get: async () => baseSchema, list: () => ALL_SETS };
  const services: Record<string, any> = { manifest: { register: vi.fn() }, objectql: ql, metadata };
  // Multi-org isolation active iff org-scoping is wired (ADR-0093 D4 — the exact
  // signal SecurityPlugin probes). `tenancy` service is absent here, so the
  // plugin falls back to the `org-scoping` probe (same as production baseline).
  if (opts.orgScoping) services['org-scoping'] = { name: 'org-scoping' };
  const ctx: any = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registerService: vi.fn(),
    getService: (name: string) => {
      if (!(name in services)) throw new Error(`no service: ${name}`);
      return services[name];
    },
  };
  return { ctx, findOne, run: async (opCtx: any) => { await middleware(opCtx, async () => {}); return opCtx; } };
}

/** Effective READ filter the engine would AND onto a `find` (the visible-row set). */
async function readFilter(cell: any, roleCtx: any): Promise<unknown> {
  const plugin = new SecurityPlugin();
  const h = makeHarness({ ...cell, orgScoping: cell.orgScoping ?? true });
  await plugin.init(h.ctx); await plugin.start(h.ctx);
  const opCtx: any = { object: cell.objectName, operation: 'find', ast: { where: undefined }, context: roleCtx };
  try { await h.run(opCtx); } catch (e: any) { return `CRUD_DENY:${e?.name ?? 'err'}`; }
  return opCtx.ast.where ?? null;
}

/**
 * Effective WRITE filter used by the by-id update pre-image check — the row the
 * caller is allowed to mutate must satisfy it. Returned as the array of RLS
 * parts ANDed with the `{id}` guard (that guard is stripped). `BYPASS` = no
 * write filter (superuser). `CRUD_DENY` = blocked before the pre-image check.
 */
async function writeFilter(cell: any, roleCtx: any): Promise<unknown> {
  const plugin = new SecurityPlugin();
  const h = makeHarness({ ...cell, orgScoping: cell.orgScoping ?? true, findOneImpl: () => null });
  await plugin.init(h.ctx); await plugin.start(h.ctx);
  const opCtx: any = {
    object: cell.objectName, operation: 'update',
    data: { id: 'r1', name: 'x' }, options: { where: { id: 'r1' } }, context: roleCtx,
  };
  let threw: any = null;
  try { await h.run(opCtx); } catch (e: any) { threw = e; }
  if (h.findOne.mock.calls.length === 0) {
    return threw ? `CRUD_DENY:${threw?.name ?? 'err'}` : 'BYPASS(no-write-filter)';
  }
  return h.findOne.mock.calls[0][1].where.$and.slice(1);
}

// ── Axes ─────────────────────────────────────────────────────────────────────
const OBJECTS = {
  // Ordinary tenant business object: has organization_id, public posture.
  task: { objectName: 'task', objectFields: ['id', 'organization_id', 'created_by', 'status', 'name'] },
  // Private object (access.default: private) — plain wildcard grant does NOT cover it (ADR-0066 ④).
  private_obj: { objectName: 'crm_secret', objectFields: ['id', 'organization_id', 'created_by', 'name'], schemaExtra: { access: { default: 'private' } } },
  // Platform-global object (tenancy.enabled: false), no organization_id column.
  platform_global: { objectName: 'sys_package', objectFields: ['id', 'name', 'visibility'], schemaExtra: { tenancy: { enabled: false } } },
  // Better-auth-managed identity table (managedBy: 'better-auth'); writes flow through better-auth.
  better_auth: { objectName: 'sys_user', objectFields: ['id', 'email', 'name'], schemaExtra: { managedBy: 'better-auth' } },
};

const ROLES = {
  // Platform admin: holds admin_full_access (viewAllRecords/modifyAllRecords) — the superuser bypass evidence.
  platform_admin: { userId: 'padmin', tenantId: 'org-1', positions: ['platform_admin'], permissions: ['admin_full_access'] },
  // Org admin: holds organization_admin (also viewAll/modifyAll, but tenant-scoped by its RLS).
  org_admin: { userId: 'oadmin', tenantId: 'org-1', positions: ['org_admin'], permissions: ['organization_admin'] },
  // Rank-and-file member: only the additive member_default baseline; org_member gates owner_only_*.
  member: { userId: 'u1', tenantId: 'org-1', positions: ['org_member'], permissions: [] },
  // Authenticated user with NO active organization → tenant scoping cannot resolve → fail-closed.
  no_org_member: { userId: 'u2', positions: ['org_member'], permissions: [] },
};

// The locked snapshot of CURRENT behavior (captured from the real middleware +
// real seeded permission sets). Read the annotations against ADR-0095:
//   • [posture-gate] platform/org admin are org-scoped on PUBLIC business
//     objects — the ADR-0066 ① gate keeps the superuser bypass from crossing
//     the tenant wall on ordinary tenant data. The bypass only fires on
//     private / platform-global / better-auth objects (W2 short-circuit).
//   • [W1-write] member.task.write is `org OR created_by` — the tenant policy's
//     OR-merge WIDENS `owner_only_writes` back to org-wide, defeating the
//     owner restriction. This is W1's write-side twin.
//   • [fail-closed] no-org member on a tenant object → deny sentinel.
const EXPECTED_MATRIX: Record<string, Record<string, { read: unknown; write: unknown }>> = {
  task: {
    // [posture-gate] org-scoped read; write = tenant only (owner_only is org_member-gated, admin is not).
    platform_admin: { read: { organization_id: 'org-1' }, write: [{ organization_id: 'org-1' }] },
    // org_admin resolves tenant_isolation from BOTH organization_admin and the member_default baseline → duplicated OR.
    org_admin: {
      read: { $or: [{ organization_id: 'org-1' }, { organization_id: 'org-1' }] },
      write: [{ $or: [{ organization_id: 'org-1' }, { organization_id: 'org-1' }] }],
    },
    // [W1-write] read is cleanly org-scoped, but the WRITE pre-image is widened to org-wide by the OR-merge.
    member: {
      read: { organization_id: 'org-1' },
      write: [{ $or: [{ organization_id: 'org-1' }, { created_by: 'u1' }] }],
    },
    // [fail-closed] no active org → tenant policy cannot compile → deny sentinel on read; write keeps only owner scope.
    no_org_member: { read: { id: DENY }, write: [{ created_by: 'u2' }] },
  },
  private_obj: {
    // [W2 bypass] superuser bit + private posture → all RLS skipped.
    platform_admin: { read: null, write: 'BYPASS(no-write-filter)' },
    org_admin: { read: null, write: 'BYPASS(no-write-filter)' },
    // A member's plain wildcard grant does not cover a private object → denied at the CRUD gate, before RLS.
    member: { read: 'CRUD_DENY:PermissionDeniedError', write: 'CRUD_DENY:PermissionDeniedError' },
    no_org_member: { read: 'CRUD_DENY:PermissionDeniedError', write: 'CRUD_DENY:PermissionDeniedError' },
  },
  platform_global: {
    // [W2 bypass] tenancy-disabled posture → superuser bypass fires.
    platform_admin: { read: null, write: 'BYPASS(no-write-filter)' },
    org_admin: { read: null, write: 'BYPASS(no-write-filter)' },
    // NOTE (pre-existing quirk): the seeded tenant_isolation uses canonical `==`,
    // which `extractTargetField` (single-`=`/IN only) cannot parse, so the
    // tenancy-disabled field-drop never fires for it — the policy compiles to an
    // org filter even though this object has no organization_id column. Locked
    // as-is; Layer 0 (D1) subsumes tenancy-disabled handling into its own "is
    // this a tenant object?" check, retiring this quirk structurally.
    member: {
      read: { organization_id: 'org-1' },
      write: [{ $or: [{ organization_id: 'org-1' }, { created_by: 'u1' }] }],
    },
    no_org_member: { read: { id: DENY }, write: [{ created_by: 'u2' }] },
  },
  better_auth: {
    // [W2 bypass] better-auth-managed posture → superuser read bypass.
    platform_admin: { read: null, write: 'BYPASS(no-write-filter)' },
    // Org admin sees own-org identity rows OR self (per-object _self carve-outs, duplicated via baseline); writes denied (better-auth door).
    org_admin: {
      read: { $or: [{ organization_id: 'org-1' }, { id: 'oadmin' }, { organization_id: 'org-1' }, { id: 'oadmin' }] },
      write: 'CRUD_DENY:PermissionDeniedError',
    },
    // Member: own-org collaborators OR self; writes denied.
    member: { read: { $or: [{ organization_id: 'org-1' }, { id: 'u1' }] }, write: 'CRUD_DENY:PermissionDeniedError' },
    // No-org member: only self (org disjunct cannot compile); writes denied.
    no_org_member: { read: { id: 'u2' }, write: 'CRUD_DENY:PermissionDeniedError' },
  },
};

describe('authz Layer-0 matrix gate — ADR-0095 pre-extraction snapshot', () => {
  it('locks the current role × object × {read,write} effective-filter matrix', async () => {
    const actual: Record<string, Record<string, { read: unknown; write: unknown }>> = {};
    for (const [oName, cell] of Object.entries(OBJECTS)) {
      actual[oName] = {};
      for (const [rName, role] of Object.entries(ROLES)) {
        actual[oName][rName] = { read: await readFilter(cell, role), write: await writeFilter(cell, role) };
      }
    }
    expect(actual).toEqual(EXPECTED_MATRIX);
  });

  // ── W1: cross-tenant read leak via a permissive business policy ────────────
  // ADR-0095 Sequencing step 0 asks specifically for this cell. A user holding a
  // permissive business RLS policy (`status == 'public'`) reads a tenant object.
  // TODAY the wildcard tenant policy is OR-merged with it, so the effective read
  // filter is `tenant OR status==public` — a row in ANOTHER org whose status is
  // public matches the second disjunct and IS VISIBLE. This test records that
  // leak. [ADR-0095 W1] After Layer 0 (D1) extraction the effective read becomes
  // `Layer0(organization_id == ctx.org) AND Layer1(status == public)`, and the
  // cross-org public row becomes invisible — at which point this assertion FLIPS
  // (see the trailing note). It is deliberately kept green now so the gate
  // locks the current (leaking) behavior before the fix.
  it('[W1] permissive business RLS currently OR-merges with tenant scope (cross-org public row VISIBLE)', async () => {
    const filter = await readFilter(OBJECTS.task, {
      userId: 'u3', tenantId: 'org-1', positions: ['org_member'], permissions: ['public_reader'],
    });
    // CURRENT (pre-D1): OR-merge — the tenant wall is just one disjunct.
    expect(filter).toEqual({ $or: [{ organization_id: 'org-1' }, { status: 'public' }] });
    // A concrete foreign-org public row would pass this filter today:
    const foreignPublicRow = { organization_id: 'org-2', status: 'public' };
    const orClauses = (filter as any).$or as Array<Record<string, unknown>>;
    const visibleToday = orClauses.some((c) =>
      Object.entries(c).every(([k, v]) => (foreignPublicRow as any)[k] === v));
    expect(visibleToday).toBe(true); // ← [ADR-0095 W1] the leak. D1 must make this false.
  });

  // ── W1's write-side twin: owner_only defeated by the tenant OR-merge ───────
  // The same OR-merge that leaks reads also WIDENS a restrictive write policy.
  // A member's `owner_only_writes` (created_by == me) is OR'd with the wildcard
  // tenant policy, so the by-id write pre-image resolves to `org OR created_by`
  // = any row in the member's org. The owner restriction is silently defeated.
  // After D1 this becomes `Layer0(org) AND Layer1(created_by == me)` = owner-only
  // — a behavior change beyond the ADR's stated single (read) delta. Locked here
  // so the extraction surfaces it for explicit review rather than shipping it
  // silently. See the PR's "second delta" callout.
  it('[W1-write] member by-id write is currently widened to org-wide by the OR-merge', async () => {
    const wf = await writeFilter(OBJECTS.task, ROLES.member);
    expect(wf).toEqual([{ $or: [{ organization_id: 'org-1' }, { created_by: 'u1' }] }]);
  });

  // ── W2: the superuser bypass short-circuits BOTH layers via one bit ────────
  // On private / platform-global / better-auth objects a superuser-bit holder
  // skips ALL wildcard RLS — tenant wall included — through a single check. On a
  // PUBLIC business object the posture gate withholds the bypass, so the admin
  // stays org-scoped. Both facets locked.
  it('[W2] superuser bypass fires on private/platform-global/better-auth, withheld on public business objects', async () => {
    expect(await readFilter(OBJECTS.private_obj, ROLES.platform_admin)).toBeNull();
    expect(await readFilter(OBJECTS.platform_global, ROLES.platform_admin)).toBeNull();
    expect(await readFilter(OBJECTS.better_auth, ROLES.platform_admin)).toBeNull();
    // Withheld on a public tenant object → admin remains org-scoped (the posture gate).
    expect(await readFilter(OBJECTS.task, ROLES.platform_admin)).toEqual({ organization_id: 'org-1' });
  });

  // ── Fail-closed: an authenticated user with no active org sees no tenant rows ─
  it('[fail-closed] no active organization → tenant read denies via the sentinel', async () => {
    expect(await readFilter(OBJECTS.task, ROLES.no_org_member)).toEqual({ id: DENY });
  });

  // ── Single-org mode: Layer 0 is inert; tenant policy stripped (parity today) ─
  // With org-scoping absent, collectRLSPolicies strips the wildcard tenant policy
  // entirely, so a member's read carries NO tenant where and the write keeps only
  // the owner scope. ADR-0095: in single mode Layer 0 contributes nothing — this
  // cell must NOT move after the extraction.
  it('[single-mode] tenant policy stripped when org-scoping is absent', async () => {
    const single = { ...OBJECTS.task, orgScoping: false };
    expect(await readFilter(single, ROLES.member)).toBeNull();
    expect(await writeFilter(single, ROLES.member)).toEqual([{ created_by: 'u1' }]);
  });
});

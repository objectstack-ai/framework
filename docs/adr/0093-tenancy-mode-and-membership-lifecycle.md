# ADR-0093: Tenancy mode as a first-class capability, and a single owner for the user→membership lifecycle

- **Status:** Proposed
- **Date:** 2026-07-13
- **Deciders:** ObjectStack Protocol Architects
- **Relates to:** [ADR-0049](./0049-no-unenforced-security-properties.md) (no unenforced security properties), [ADR-0057](./0057-erp-authorization-core-business-units-and-scope-depth.md) (org-scoped identity optionality), [ADR-0068](./0068-unified-user-context-and-built-in-identity-roles.md) (platform-admin gate), [ADR-0092](./0092-sys-user-profile-field-delegation.md) (identity write guard), the default-org bootstrap (`plugin-auth/src/ensure-default-organization.ts`, referenced in code as "ADR-0081 D1" — that decision record predates this repo's ADR series), #2766 (admin user management), PR #2882 (single-org create-user membership bind — the tactical fix this ADR generalizes)

## TL;DR

Two structural gaps produced the bug fixed in PR #2882, and will keep producing
siblings of it until closed:

1. **"Every new user gets an organization membership" is not owned by anyone.**
   It is re-implemented (or forgotten) per creation path: invite ✅, add-member ✅,
   SSO JIT ✅, cloud host hook ✅, `/admin/create-user` ❌ (fixed tactically in
   #2882), `/admin/import-users` ❌, self-signup ❓ (undefined). Each new creation
   path is a new place to forget the invariant.
2. **"What tenancy mode is this deployment in?" has no single answer.** At least
   four independent signals answer it today — the `OS_MULTI_ORG_ENABLED` env flag,
   the `org-scoping` service probe, counting `sys_organization` rows (PR #2882's
   heuristic), and the frontend `features.multiOrgEnabled` / `features.organization`
   pair — and they can disagree. The worst disagreement is silent: requesting
   multi-org without the enterprise package installed degrades to **zero tenant
   isolation with only a console warning** (`serve.ts`), an ADR-0049-class
   unenforced security property.

Decision:

- **D1** — The membership invariant is: *in any deployment where the organization
  capability is on, every human user ends the creation pipeline with ≥ 1
  `sys_member` row, unless the deployment's membership policy says otherwise.*
  Policy is explicit, not emergent: `auto` (default) / `invite-only`.
- **D2** — One owner: plugin-auth composes a **membership reconciler** into
  better-auth's `user.create.after` database hook — the one seam every creation
  path (signup, admin create, import, SSO JIT) already flows through. Host hooks
  chain first and win; the reconciler yields to any membership that already
  exists. Endpoint-level binds (PR #2882) are retired in favor of it.
- **D3** — Target-org resolution consumes the tenancy service (D4), never data
  shape: `single` mode → the default org; `multi` mode → the framework does not
  guess (invite / JIT / host hooks own it). The "exactly one org row" counting
  heuristic from PR #2882 is retired.
- **D4** — A **`tenancy` kernel service** becomes the single source of truth:
  `{ mode, isolationActive, requested, degraded, defaultOrgId() }`. plugin-auth
  registers the baseline; `@objectstack/organizations` upgrades it. Every current
  consumer (SecurityPlugin RLS stripping, SQL-driver tenant audit gate,
  `/auth/config` features, CLI wiring) migrates to it.
- **D5** — The degraded middle state **fails fast**: `OS_MULTI_ORG_ENABLED=true`
  without a working `@objectstack/organizations` refuses to boot. The only escape
  hatch is an explicit `OS_ALLOW_DEGRADED_TENANCY=1`, which brands the deployment
  `degraded: true` end-to-end (boot banner, `/auth/config`, Setup dashboard).
- **D6** — A bounded, idempotent **backfill** binds pre-existing member-less users
  to the default org on `kernel:ready` — single-org mode only.
- **D7** — Edge-case ledger: existing memberships always win; platform-admin
  bootstrap keeps its own path; phone-only users bind like anyone else;
  multi-org backfill is explicitly refused.
- **D8** — Non-goals: single-org membership still does **not** gate data access;
  RLS strip semantics, the dual frontend feature flags, and better-auth's
  ownership of member CRUD are all unchanged.

## Context

### How the platform got here

The single-org / multi-org split is an open-core seam: the open framework ships
member-management basics (better-auth org plugin, invitations, the default-org
bootstrap), while `@objectstack/organizations` (enterprise) adds the multi-tenant
runtime — `organization_id` auto-stamping, per-org seed replay, and the
`org-scoping` service whose *presence* SecurityPlugin probes at `start()` to
decide whether wildcard `tenant_isolation` RLS policies apply or are stripped.

This seam is sound. What grew up around it is not:

**Membership creation is distributed.** better-auth owns `sys_member` rows for
its own flows (invite-accept, add-member, SSO `organizationProvisioning`). The
cloud host injects a `user.create.after` hook that provisions a personal org per
new user. The open framework bootstraps a Default Organization for the platform
admin. But the framework itself never took ownership of the general invariant —
so paths that create users *outside* better-auth's org flows (`/admin/create-user`,
`/admin/import-users`, plain email signup) produce **member-less users**. In
single-org mode a member-less user is degraded in concrete ways:

- the ADR-0081-D1 `session.create.before` hook resolves `activeOrganizationId`
  from the user's `sys_member` row — no row ⇒ **null active org for every
  session**, so better-auth org endpoints can't resolve an org for them and
  `{current_org_id}` navigation tokens fall back;
- the Setup app's Members list omits them, right next to an Invite flow that
  *does* create membership — the operator-visible inconsistency reported against
  PR #2882.

**Mode detection is ambient.** `resolveMultiOrgEnabled()` (env), the
`org-scoping` probe (service graph), `sys_organization` row-count (data), and
`features.*` (frontend) are four cached-at-different-times views of one fact.
PR #2882 had to add the fourth precisely because no service exposed the first
two to an endpoint at request time. Ambient facts drift; drifted security facts
violate ADR-0049.

**The degraded state is silent.** `serve.ts` handles "multi-org requested,
enterprise package missing" with a `console.warn` and continues booting with
tenant RLS stripped. An operator who reads logs carefully knows their org
boundaries are inert; everyone else believes they are multi-tenant. This is the
platform's largest tenancy footgun and it costs one boot-time check to close.

### Why now

PR #2882 fixed one endpoint. The same fix is owed to `/admin/import-users`; the
signup question is open; and any future creation surface (SCIM, phone-OTP
first-login, marketplace flows) re-asks the same question. Fixing call sites
one-by-one is how the platform got here. The cheap moment to centralize is now,
while the set of creation paths is still enumerable.

## Decisions

### D1 — The membership invariant, stated once

> In a deployment where the organization capability is enabled, every **human**
> user must hold at least one `sys_member` row by the end of the creation
> pipeline, unless the deployment's membership policy opts out.

- **Policy knob:** `auth.membershipPolicy: 'auto' | 'invite-only'`, default
  `'auto'`.
  - `auto` — the reconciler (D2) binds new users to the resolved target org
    (D3) when no membership exists.
  - `invite-only` — the reconciler never auto-binds; membership is granted only
    through explicit flows (invite-accept, add-member, SSO JIT, host hooks).
    Deployments that run invite-only discipline choose it consciously instead
    of getting it as an accident of which endpoint created the user.
- Self-signup follows the same policy — no signup-specific membership branch.
  (Whether signup is *open at all* remains the existing, separate registration
  toggle; this ADR does not couple the two.)
- Default role for auto-bound users is `member`. Elevation is a separate,
  audited action (`update-member-role`), never part of creation.

**Rejected alternative:** making membership strictly mandatory (no policy knob).
Rejected because invite-only single-org deployments are legitimate (a shared
service with app end-users who are deliberately *not* teammates), and a
framework that force-joins every end-user into the operator org would be wrong
for them.

### D2 — One owner: the membership reconciler hook

plugin-auth composes a `user.create.after` step into `composeDatabaseHooks`,
exactly as the identity-source stamp (`account.create.after`) is composed today:

```
host user.create.after (if any)  →  framework membership reconciler
```

- **Coverage:** every creation path flows through better-auth's user pipeline —
  email signup, `/admin/create-user` (wrapper drives `authApi.createUser`),
  `/admin/import-users` (same), SSO JIT. One seam, all paths — including future
  ones, which inherit the invariant without knowing it exists.
- **Yield rule:** the reconciler first checks for *any* existing `sys_member`
  row for the user and no-ops if one exists. This makes host composition safe
  by construction: the cloud's personal-org provisioning hook runs first,
  creates the membership, and the framework reconciler sees it and yields.
  No double-membership, no ordering negotiation beyond "host first" (the
  existing composition contract).
- **Failure semantics:** best-effort. A failed bind logs a structured warning
  and never fails user creation — membership is recoverable bookkeeping; a
  created-but-unbindable user is strictly better than a failed signup. The
  D6 backfill is the self-healing net for exactly these misses.
- **Idempotency:** keyed on the `(organization_id, user_id)` unique index;
  the check-then-insert tolerates races because a lost race hits the unique
  index and is swallowed as "already bound".
- **Observability:** every reconciler outcome (`bound` / `yielded` /
  `policy-skip` / `no-target-org` / `failed`) emits one structured log line,
  and `bound` writes the same audit metadata PR #2882 introduced
  (`organizationId`, `membershipCreated`).
- **Retirement:** the endpoint-level `bindUserToSoleOrganization` (PR #2882)
  is deleted once the reconciler lands; its tests migrate to the reconciler.
  Interim double-coverage is harmless (both sides are idempotent and
  yield-to-existing).

**Rejected alternatives:**
- *Per-endpoint helper calls* (status quo after #2882): every future endpoint
  re-must-remember; this is the failure mode being fixed.
- *ObjectQL lifecycle hook on `sys_user` insert*: better-auth adapter writes
  carry no request context, and the identity write guard (ADR-0092) already
  establishes that better-auth-managed tables are governed at the better-auth
  seam, not the engine seam. Follow the precedent.

### D3 — Target-org resolution consumes declared mode, never data shape

The reconciler asks the tenancy service (D4):

| `tenancy.mode` | Target org |
|:---|:---|
| `single` | `tenancy.defaultOrgId()` — the bootstrap org (stable `slug='default'`), or the sole org row if a deployment renamed it |
| `multi` | none — framework never guesses; invite / JIT / host hooks own membership |

The PR #2882 heuristic — *bind iff exactly one `sys_organization` row exists* —
was the correct call for an endpoint that had no better signal, and the wrong
long-term contract: it infers configuration from data shape, so a multi-org
deployment's transient first-boot state (one org created, second pending) is
indistinguishable from single-org. Mode is configuration; read it as such.

### D4 — The `tenancy` kernel service

Registered under the service name **`tenancy`**:

```ts
interface TenancyService {
  /** Resolved mode. Static after kernel:ready. */
  mode: 'single' | 'multi';
  /** True iff org-scoping (auto-stamp + tenant RLS) is actually active. */
  isolationActive: boolean;
  /** What the operator asked for (OS_MULTI_ORG_ENABLED). */
  requested: boolean;
  /** requested && !isolationActive — the D5 branded state. */
  degraded: boolean;
  /** Single mode: the default org id (bootstrapping it if absent). Multi: null. */
  defaultOrgId(): Promise<string | null>;
}
```

- **Registration:** plugin-auth registers the baseline implementation at
  `init()` (env flag + lazy default-org resolution).
  `@objectstack/organizations` **replaces** it during its own `init()` (it
  registers before SecurityPlugin per the existing ordering contract), setting
  `isolationActive: true`. Presence-probing of `org-scoping` remains for one
  deprecation cycle, then SecurityPlugin consumes `tenancy.isolationActive`.
- **Migration of consumers** (each currently re-derives the fact):
  1. SecurityPlugin's RLS strip gate → `tenancy.isolationActive`;
  2. SQL driver's tenant-audit gate → `tenancy.isolationActive`;
  3. auth-manager `/auth/config` `features.multiOrgEnabled` → `tenancy.mode`;
  4. `serve.ts` / dev / runtime wiring → `tenancy.requested`;
  5. the D2 reconciler → `tenancy.mode` + `defaultOrgId()`.
- `resolveMultiOrgEnabled()` remains the *input parser* for the env flag but
  stops being a decision point anywhere outside the tenancy implementation.

**Rejected alternative:** a kernel-built-in tenancy object. The kernel has no
tenancy concept today and should not grow one for what is an auth/organizations
concern; a service keeps the open-core seam where it already is.

### D5 — Degraded tenancy fails fast

At boot, when `tenancy.requested === true` and the organizations package fails
to load (missing, or its `init()` throws):

- **Default: refuse to boot.** Exit non-zero with an actionable error naming
  the package, the flag, and the two remedies (install the package / unset the
  flag). A deployment that *asked* for tenant isolation and cannot have it
  must not serve traffic pretending otherwise — this is ADR-0049 applied to
  deployment configuration.
- **Escape hatch:** `OS_ALLOW_DEGRADED_TENANCY=1` boots anyway, with
  `tenancy.degraded = true` propagated everywhere an operator looks: a red
  boot banner, `/auth/config` (`degradedTenancy: true`), and the Setup
  system-overview dashboard. Degraded operation becomes a visible, chosen
  state instead of a log line.
- **Rollout honesty:** some existing deployments are unknowingly degraded
  today; fail-fast will stop them on upgrade. That is the point — but the
  release notes must say so loudly, and the error message must make recovery
  a two-minute task. Shipping this in a minor release with a prominent
  BREAKING callout is acceptable; shipping it silently is not.

### D6 — Backfill for pre-existing member-less users

On `kernel:ready`, **single mode + `membershipPolicy: 'auto'` only**:

- find users with zero `sys_member` rows (bounded scan, same pattern and
  limits as `backfillOrgAdminGrants`), bind each to `defaultOrgId()` with
  role `member`;
- idempotent, failure-isolated per user, one structured summary log
  (`scanned / bound / skipped`);
- ordered *after* `ensureDefaultOrganization` (which it composes with — the
  platform admin's own bind stays that helper's job, and the yield rule keeps
  them from colliding);
- opt-out: `OS_SKIP_MEMBERSHIP_BACKFILL=1` for operators who curate
  memberships manually.

Multi-org backfill is **refused by design** — there is no correct guess, and a
wrong org assignment in a tenant-isolated deployment is a data-exposure bug,
not a convenience. Multi-org operators repair membership through the existing
admin surfaces.

### D7 — Edge-case ledger

| Case | Ruling |
|:---|:---|
| User already has any membership | Reconciler and backfill always yield (existing rows win — same principle as `ensureDefaultOrganization`) |
| Platform admin bootstrap | Unchanged; `ensureDefaultOrganization` keeps owning the admin's `owner` bind. The reconciler would bind admins as `member` only if the bootstrap hasn't run, and the bootstrap's own yield check makes the sequence safe in either order |
| Phone-only / placeholder-email users | Bind normally — they are teammates; membership is not email-dependent |
| IdP-provisioned (SSO JIT) users | `organizationProvisioning` creates their membership before the reconciler sees them → yield. If JIT ever misses (no domain-matched org in single mode), the reconciler is the net |
| Impersonation sessions | No change — active-org resolution is session-time, membership is create-time |
| User leaves their only org | Allowed today, unchanged. The invariant governs *creation*, not the full lifecycle; a leave-then-rejoin flow is user intent |
| Machine / service accounts | Out of scope now; when a first-class service-account marker exists, it should exempt from auto-bind (tracked as a follow-up, not blocking) |

### D8 — Non-goals (explicit refusals)

1. **Single-org membership still does not gate data access.** RLS stripping
   semantics are untouched; RBAC permission sets remain the single-org access
   authority. Making `sys_member` authorization-relevant in single mode is a
   different, larger decision — refused here to keep this ADR mechanical.
2. **The dual frontend flags keep their meaning.** `features.organization`
   (member management available) vs `features.multiOrgEnabled` (org management
   available) is a deliberate ADR-0081-D1 distinction; only their *backing
   fact* moves to the tenancy service.
3. **better-auth keeps owning `sys_member` CRUD.** The reconciler writes
   through the system context exactly as `ensureDefaultOrganization` does; no
   new generic-CRUD opening on identity tables (ADR-0092 stands).
4. **No new org-resolution cleverness in multi mode.** Domain matching,
   actor-active-org inheritance, etc. remain the province of the flows that
   have real context (JIT, invites, host hooks).

## Rollout

| Phase | Contents | Risk |
|:---|:---|:---|
| 0 (shipped) | PR #2882 — endpoint-level bind on `/admin/create-user` | none (idempotent, best-effort) |
| 1 | `tenancy` service + D5 fail-fast (+ `OS_ALLOW_DEGRADED_TENANCY`) | boot-blocking for unknowingly-degraded deployments — release-notes callout required |
| 2 | D2 reconciler (+ `membershipPolicy`), consumers migrate to `tenancy`, retire the #2882 endpoint bind and extend coverage to `/admin/import-users` for free | low — yield rule + idempotency make double-coverage safe during the transition |
| 3 | D6 backfill + docs (deployment guide: tenancy modes, membership policy, degraded state) | low — bounded, opt-out |

Phases 1 and 2 are independently shippable; 1 first is recommended because the
reconciler (2) consumes the service (1), and because 1 closes the only
security-relevant gap.

## Consequences

**Positive.** The membership invariant becomes unforgeable-by-omission — future
creation paths inherit it. Tenancy mode becomes a declared, queryable fact with
one implementation; the security-relevant "degraded" state becomes impossible
to enter silently. The class of bug behind PR #2882 is closed, not patched.

**Negative / accepted.** One more kernel service and one more config knob
(`membershipPolicy`). Fail-fast will halt upgrades for deployments that were
silently degraded — accepted deliberately; the alternative is leaving them
believing they are tenant-isolated. The reconciler adds one indexed read per
user creation (negligible; creation is rare and already multi-write).

**Deferred.** Service-account exemption (D7); any authorization role for
single-org membership (D8.1); multi-org target-org policy beyond "don't guess"
(D8.4).

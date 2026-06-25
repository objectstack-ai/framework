# ADR-0073: Automation execution identity — a built-in non-human principal for user-less runs, `runAs` as authorization posture, attribution always concrete

**Status**: Proposed (2026-06-25)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0049](./0049-no-unenforced-security-properties.md) (enforce-or-mark gate; stage by whether the feature exists), [ADR-0057](./0057-erp-authorization-core-business-units-and-scope-depth.md) (`sys_role` is platform-native; `ExecutionContext.roles`; scheduled/lifecycle jobs), [ADR-0066](./0066-unified-authorization-model.md) (capability / assignment / requirement separation — resources declare a capability, never "who"), [ADR-0068](./0068-unified-user-context-and-built-in-identity-roles.md) (`EvalUser` / `current_user`; **identities are roles, not booleans**)
**Consumers**: `@objectstack/spec` (the identity contract), `@objectstack/plugin-security` (`resolve-execution-context`, RLS, seeded roles), `@objectstack/service-automation` (the engine's `runAs` resolution), `@objectstack/trigger-schedule` + `@objectstack/trigger-api` (user-less trigger surfaces), `@objectstack/plugin-reports` (the report scheduler — today hand-rolls `SYSTEM_CTX`), `@objectstack/runtime` (audit actor), and the ADR-0057 lifecycle/retention jobs.

**Premise**: pre-launch — specify the target end-state, then land only the non-speculative slice now (ADR-0049). This ADR **completes** the identity model: ADR-0068 unified the *human* identity surface (`current_user`, identities-as-roles); this ADR adds the **non-human / automation** identity that user-less runs need, in the same idiom.

> **Trigger**: #1888 enforced flow `runAs`, and the follow-up #2308 surfaced that a **schedule-triggered** flow with the default `runAs:'user'` has **no trigger user** → the data-layer security middleware *skips* (it skips on no-identity by design, delegating auth to the auth layer) → the run executes **UNSCOPED** (effectively elevated). #2308 made that fail-open *audible* (a build-time lint + a runtime warning) but deliberately did **not** change the runtime identity — because the right fix is a platform-identity decision, recorded here.

---

## TL;DR

1. **[new] Automation is a first-class non-human identity, expressed as built-in roles** (the ADR-0068 idiom): seed reserved `sys_role` rows `automation` (org-scoped — app-authored scheduled/user-less flows) and `platform_automation` (unscoped — platform-internal jobs only). A user-less run resolves to an `EvalUser` whose `id` is a stable automation principal and whose `roles` carry the automation role. There is **no anonymous run**.
2. **[new] `runAs` declares *authorization posture*, not identity** — decoupling the two axes the platform conflates today:
   - `user` — run as the triggering human (only valid when one exists);
   - **`automation`** (the new default for user-less triggers) — run as the automation principal **with RLS enforced** against its grants (Salesforce "with sharing"; the safe middle);
   - `system` — full elevation (`isSystem`, RLS-bypassing) — explicit opt-in, **back-compat unchanged**, always audited.
3. **[new] Attribution is always concrete** — every run carries an identity, so the **audit actor** is the human, the automation principal, or `platform_automation`. **No more `created_by = NULL` automation writes.** Attribution is recorded at the audit layer and is **decoupled from record ownership** (automation must not silently *own* the rows it writes, or owner-RLS would hide them from humans).
4. **[ruled] User-less + `runAs:'user'` is a configuration error** (no user to scope to). Mainstream platforms do not offer "as the triggering user" for scheduled work; neither do we.
5. **Staging (ADR-0049)**: land the **contract + seeded roles + lint completeness** now (foundational, non-breaking, mirrors ADR-0068 v1); defer the **runtime wiring** (attribution, then the `automation`-default authorization + scopable grants) to M2 as the roadmapped enforcement.

---

## Context

### The two axes the platform conflates

"What identity does a run execute under when there is no human?" is the classic **confused-deputy** problem. Mature platforms keep two axes separate:

- **Authorization** — what may the run read/write? (RLS / permission context)
- **Attribution** — who is recorded as having done it? (audit identity)

ObjectStack collapses both into "is `context.userId` present?", which is why the user-less case both (a) loses authorization (skips → unscoped) and (b) loses attribution (`created_by = NULL`).

### What the surfaces do today (code-grounded)

| Run | Authorization | Attribution |
|---|---|---|
| `runAs:'user'` (human present) | trigger user + full RLS | `created_by = userId` |
| `runAs:'system'` | `{isSystem:true}` → bypasses **everything** (object perms + RLS) | `created_by = NULL` (orphan) |
| user-less + `user` (schedule/webhook) | **skips** → UNSCOPED (the #2308 fail-open) | `created_by = NULL` (orphan) |

Two findings sharpen the problem:

- **Automation creates orphan records.** `created_by` is stamped from `session.userId` (`@objectstack/objectql` insert hook); a `system`/user-less run has no `userId` → `created_by = NULL`. The existence of `claimSeedOwnership` (re-owning NULL rows to the first admin) is the tell. "NULL-then-claim" works for **one-time seeds** (a single claim event) but **fails for perpetual automation** — a nightly sweep has no claim event, so unattributed rows accumulate forever.
- **The standing system user was deliberately removed.** `SystemUserId.SYSTEM` (`usr_system`) is vestigial ("NO LONGER AUTO-PROVISIONED", `system-names.ts`). That removal was about **seed ownership ergonomics**, not automation — so it does not bar a non-human *execution* identity, but it does warn us not to recreate a seed-ownership crutch.

### How mainstream platforms solve it

| Platform | Authorization for automation | Attribution |
|---|---|---|
| **Salesforce** | System Context with author choice: *without sharing* (god-mode) vs **with sharing** (elevated object/FLS, record sharing still enforced). Never "as the triggering user". | dedicated **"Automated Process"** system user. |
| **ServiceNow** | scheduled jobs/flows have a **"Run as"** service account; ACLs evaluated against it. | the service account. |
| **AWS IAM** | per-task **execution role** — a first-class non-human principal, **least-privilege**, assumed per-invocation. | the role, in CloudTrail. |
| **Kubernetes** | every workload (incl. CronJobs) runs under a **ServiceAccount**; RBAC against it. | the ServiceAccount. |
| **iPaaS (Workato/Zapier)** | steps run as the **connection owner** (the configured credential). | the connection. |
| **GitHub Actions** | scoped `GITHUB_TOKEN`; default shifted broad → read-only (least-privilege trend). | the workflow token. |
| **Postgres** | `SECURITY DEFINER` = "run as definer" — documented as a privilege-escalation **footgun**. | the role. |

**Four invariants they converge on**: (1) automation always runs as a **concrete, named, non-human principal** — never "no one", never ambient god-mode; (2) **authorization ≠ attribution**; (3) **safe, explicit defaults**, least-privilege as the trend; (4) **elevation is explicit and audited**. ObjectStack violates (1) and (2) for the user-less case.

This primitive is **not flow-specific**: `plugin-reports` already hand-rolls `SYSTEM_CTX = {isSystem:true}`, audit writes, the ADR-0057 retention/lifecycle jobs, future queue/webhook consumers, and autonomous AI agents all need the same non-human identity. Building it inside the flow engine would be a mistake — it is a **platform identity primitive**.

---

## Decision

### D1 — A non-human automation identity, expressed as built-in roles [new]

Extend ADR-0068's "identities are roles" to the non-human case. Seed reserved, managed `sys_role` rows (siblings of `platform_admin` / `org_*`), carrying `label` + `description`:

| name | scope | meaning |
|---|---|---|
| `automation` | org-scoped (`organization_id` = the run's tenant) | the identity for **app-authored** scheduled / user-less flows within a tenant. |
| `platform_automation` | unscoped (`org_id = null`) | the identity for **platform-internal** jobs (retention, telemetry, migrations). **Not author-selectable** — reserved for the platform, sibling to `platform_admin`. |

A user-less run resolves to an `EvalUser` (ADR-0068) whose `id` is a stable automation principal id and whose `roles` include the appropriate automation role. It appears as `current_user` like any other identity — so RLS policies, formulas, and audit treat it uniformly, with **zero bespoke booleans** (ADR-0068 D2). The principal is **non-loginable** and excluded from human/admin enumerations (the existing `usr_system` exclusion guards already model this).

> This does **not** resurrect `usr_system` as a seed-ownership crutch (seeds keep NULL-then-claim, ADR's removal intact). It adds a non-human **execution + attribution** identity in the modern idiom.

### D2 — `runAs` declares authorization posture, not identity [new]

`runAs` stops meaning "system vs user" (which conflates the two axes) and becomes a declaration of authorization posture, resolved against the run's available identity:

| `runAs` | authorization | when |
|---|---|---|
| `user` | the triggering **human** + full RLS | only valid when a human triggered the run |
| **`automation`** | the **automation principal**, **RLS enforced** against its grants (object perms + record-level RLS both apply) | the **default for user-less triggers** (schedule, unauthenticated webhook, internal `execute`) |
| `system` | `{isSystem:true}` — full elevation, RLS-bypassing | explicit opt-in; **semantics unchanged from today** (back-compat) |

`automation` is the Salesforce-"with sharing" middle that ObjectStack's binary `system`/`user` cannot express today: elevated enough to act as the platform, but **still subject to row-level security and its own permission grants**, so a scheduled flow can never quietly exceed what the automation principal is allowed.

### D3 — Attribution is always concrete, and decoupled from ownership [new]

- Every run carries an identity, so the **audit actor** is always concrete: the human, `automation`, or `platform_automation`. The anonymous/`NULL` automation write is eliminated.
- **Attribution ≠ ownership.** Automation must **not** be force-stamped as `created_by` / `owner_id` of the rows it writes — owner-RLS keys on `created_by == current_user.id` (ADR-0057/0068), so automation-owned rows would become **invisible to the humans they are for**. Salesforce models this exactly: `CreatedBy = Automated Process` (audit) while `OwnerId` is set by the flow logic. Therefore: record the automation actor at the **audit layer**; let flow logic set ownership explicitly (or leave it to the normal default), not the execution identity.

### D4 — Scope follows the isolation boundary (ADR-0068 D3) [ruled]

- The `automation` identity is **tenant-scoped**: a scheduled flow belongs to an app installed in a tenant, so its automation principal carries that tenant's `organizationId`; RLS evaluates within the tenant; its grants bound what it can touch.
- `platform_automation` is the **only** cross-tenant automation identity, reserved for platform-internal jobs and never author-selectable. This mirrors `platform_admin` (operator) vs `org_admin` (tenant) and resolves "which tenant does a scheduled sweep run in?" — its own.

### D5 — User-less `runAs:'user'` is a configuration error [ruled]

A scheduled / unauthenticated-webhook trigger has no user; `runAs:'user'` there is incoherent. Validation rejects it (extending the #2308 lint into a hard author-time/compile rule for **all** user-less trigger types, not just schedule). The author picks `automation` (default) or `system`.

---

## Scope

**v1 (land now — foundational contract + the present, non-speculative gap):**
- **Define** the automation identity contract (`EvalUser`-shaped, D1) in `@objectstack/spec` and **seed** the `automation` / `platform_automation` `sys_role` rows (non-breaking; nothing enforces against them yet — exactly how ADR-0068 v1 seeds `platform_admin`/`org_*`).
- **Lint completeness**: extend the #2308 `flow-schedule-runas-unscoped` rule to every user-less trigger type (api/webhook/queue), and turn user-less `runAs:'user'` into a validation error (D5) at compile time.
- Runtime behavior is **unchanged** from #2308 (the audible warning stays); no identity is wired into `runAs` resolution yet.

**M2 (roadmapped enforcement — ADR-0049 "build with the feature"):**
- **Attribution wiring first (non-breaking)**: user-less runs carry the automation principal as the **audit actor** (D3) — concrete attribution without changing authorization.
- **Authorization next (the behavior change)**: `runAs:'automation'` becomes the default for user-less triggers and **runs RLS-enforced** (D2); assign capabilities/permission-sets to the automation role (ADR-0066) so admins can least-privilege automation. Ship **default-broad → tighten** (the GitHub-Actions playbook) so AI-authored flows are not denied on day one, with each flow's effective automation grants **visible and restrictable**.
- Keep `runAs:'system'` = god-mode throughout.

**Non-goals / deferred:**
- A full IAM-style per-flow custom role surface (over-engineering pre-MVP; the two built-in roles + permission-set assignment suffice).
- Migrating `plugin-reports` / audit / lifecycle jobs off their ad-hoc `SYSTEM_CTX` onto the principal — a fast-follow once the principal exists, tracked separately.
- Capability-gating of the automation identity (follows ADR-0066 / cloud#474).

---

## Consequences

**Good**
- Closes the user-less **fail-open** at its root: a scheduled run is RLS-enforced against a named, least-privilege-able principal — not skipped-into-god-mode.
- Ends **anonymous automation writes**: every system-initiated change is attributable (audit/compliance: SOC2/ISO want every mutation tied to a principal).
- One identity model: automation is just another `current_user` with `roles[]` (ADR-0068), so RLS/formula/audit/AI-authoring need **no new concept**.
- Gives the platform a **reusable** non-human principal that `plugin-reports`, audit, ADR-0057 lifecycle jobs, webhooks, and AI agents can all adopt — replacing scattered `SYSTEM_CTX` hacks.
- `runAs:'system'` stays exactly as-is → **no migration break** for existing elevated flows.

**Bad / costs**
- A new built-in role + a stable principal id to seed and guard (reuses ADR-0068's seeding + the `usr_system` exclusion guards).
- The M2 authorization flip (`automation` default, RLS-enforced) is a behavior change for user-less flows that today run unscoped — mitigated by default-broad-then-tighten and by the #2308 warning + v1 lint giving authors long advance notice.
- A third `runAs` value enlarges the author surface (justified: it is the most-requested real mode, and the safe default).

## Alternatives considered

- **Keep NULL-then-claim for automation.** Rejected: there is no "claim event" for perpetual automation, so attribution never converges; and it does nothing for authorization.
- **Pure runtime warning (the #2308 stopping point).** Necessary but insufficient: it makes the fail-open audible without eliminating it, and leaves writes unattributed.
- **Fail-closed (deny user-less data ops).** Rejected in #2308: breaks legitimate scheduled CRUD (2/3 example flows relied on the default) and gives no attribution.
- **Reuse `runAs:'system'` for scheduled (silent elevation).** Rejected: hides author intent and is exactly the ambient god-mode the four invariants warn against.

## Migration / conformance checklist

1. **`@objectstack/spec`** — document the automation identity as an `EvalUser` (D1); add `runAs:'automation'` to `FlowSchema.runAs` (describe), with the three-posture semantics (D2).
2. **`plugin-security`** — seed `automation` / `platform_automation` `sys_role` rows (sibling to `bootstrap-declared-roles`), with labels/descriptions; extend the non-human exclusion guards to the new principal.
3. **`@objectstack/cli`** — extend `flow-schedule-runas-unscoped` to all user-less trigger types; make user-less `runAs:'user'` a hard validation error (D5).
4. **`service-automation`** *(M2)* — `resolveRunContext` resolves user-less runs to the automation `EvalUser`; `runAs:'automation'` threads an RLS-enforcing context (not `isSystem`); audit actor stamped (D3).
5. **`runtime` / audit** *(M2)* — record the automation actor; do **not** stamp `created_by`/`owner_id` to it (D3).
6. **`plugin-reports`, ADR-0057 jobs** *(fast-follow)* — adopt the principal in place of ad-hoc `SYSTEM_CTX`.

## References

- #1888 (flow `runAs` enforcement), #2308 (schedule/user-less fail-open made audible — this ADR's trigger).
- ADR-0049 (enforce-or-mark staging), ADR-0057 (sys_role / scope / lifecycle jobs), ADR-0066 (capabilities), ADR-0068 (EvalUser / identities-as-roles).

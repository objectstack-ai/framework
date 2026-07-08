# ADR-0090: Permission Model v2 — Concept Convergence, Final Naming, and AI-Authoring Safety

**Status**: Proposed (2026-07-08)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0049](./0049-no-unenforced-security-properties.md) (enforce-or-remove),
[ADR-0056](./0056-permission-model-landing-verification.md) (permission-model landing verification),
[ADR-0057](./0057-erp-authorization-core-business-units-and-scope-depth.md) (ERP authorization core: BU tree, scope depth, `sys_user_role`),
[ADR-0066](./0066-unified-authorization-model.md) (secure-by-default `'*'` posture),
[ADR-0086](./0086-authz-metadata-config-boundary-and-cross-package-composition.md) (authz metadata↔config boundary)
**Amends / supersedes**: ADR-0056 **D7** (default-profile fallback — replaced by D5 here);
ADR-0057 **D5**'s `role_and_subordinates` deprecated-alias clause and **D7**'s "one-release aliases"
discipline (superseded by the pre-launch one-step renames in D3/D4 here).
**Consumers**: `@objectstack/spec`, `@objectstack/plugin-security`, `@objectstack/plugin-sharing`,
`@objectstack/plugin-auth`, `@objectstack/runtime`, ObjectUI (Studio Data + Access pillars, Setup).
**Companion document**: [docs/design/permission-model.md](../design/permission-model.md) — the complete,
maintained reference for the model this ADR decides. The ADR records *why*; the companion records *what/how*.

---

## TL;DR

ADR-0056/0057 landed the enforcement machinery (OWD, sharing, FLS, scope depth, BU tree). This ADR
fixes what the machinery is **wrapped in**: the concept count, the names, the defaults, and the
authoring-safety story. Three forcing facts:

1. **The platform has not launched.** This is the only zero-cost window for breaking renames and
   removals. Aliases and one-release deprecation ladders written now become permanent migration debt.
2. **The metadata is AI-authored.** The error space of AI-generated authorization metadata is
   proportional to the size and ambiguity of the authoring vocabulary. Every removed concept, alias,
   and synonym removes a class of plausible-but-wrong output that no reviewer reliably catches.
3. **A dogfood incident proved the default is wrong.** An object created without `sharingModel` +
   an ordinary C/R/U permission set silently produced **org-wide read AND write** of other users'
   records (surfaced via objectstack-ai/objectui#2348). The admin's mental model ("grant Read =
   read your own") and the runtime's actual default ("no OWD = fully public") disagree — the most
   dangerous kind of security bug, because nothing looks broken.

Eight decisions:

- **D1** — Custom objects default to OWD `private`; an unset `sharingModel` no longer means "public".
- **D2** — The Profile concept is removed (`isProfile` deleted, not deprecated).
- **D3** — `sys_role` and friends are renamed to `position`; **"role" becomes a reserved-forbidden
  word** across identifiers, UI copy, and docs (lint-enforced), with the better-auth boundary as the
  single documented exception.
- **D4** — The OWD vocabulary shrinks to the four canonical values; legacy aliases are removed from
  the spec enum, not tolerated at parse time.
- **D5** — A built-in, undeletable **`everyone` position** carries default grants for authenticated
  users; packages *suggest*, admins *confirm*, resolution is per-request (no materialized copies, no
  fallback cliff).
- **D6** — An **explain engine** (`why can user X do OP on record Y`) is promoted to P0, and an
  **access-matrix snapshot** gates every publish of security-domain metadata.
- **D7** — Security-domain metadata gets a publish-time **linter** and a **tiered human gate**;
  non-security metadata may auto-publish.
- **D8** — **Teams receive sharing; they never carry capability.** No permission-set bindings, no
  record ownership on `sys_team`.

The resulting admin-facing model is five words, each with exactly one industry-unambiguous reading:
**permission set** (capability), **position** (distribution), **business unit** (visibility geometry),
**sharing/OWD** (record baseline + widening), **team** (collaboration reception).

---

## Context

### The launch window

ADR-0057 D5/D7 prescribed deprecated aliases and one-release rename ladders — the correct discipline
for a live platform. The platform is not live. Compatibility layers authored before launch are pure
cost: they ship the old and the new vocabulary simultaneously into the first release, doubling the
surface AI and admins can pick wrongly from, and committing us to a deprecation cycle nobody is on
the other end of. This ADR explicitly supersedes those clauses: **renames and removals below are
one-step, with no aliases.**

### AI authors the metadata

Objects, permission sets, and sharing rules on this platform are drafted by AI (Studio copilot,
agents) at least as often as by humans. For authorization metadata specifically, an AI error is not a
bug but a silent security incident. Two consequences drive this ADR:

- **Vocabulary is attack surface.** A model with 9 overlapping layers, 3 things named "role", and a
  7-value OWD enum (3 of them aliases) offers countless "plausible" wrong combinations. A model with
  5 orthogonal concepts and 4 enum values is one an LLM can be *constrained* to author correctly.
- **Structure is the precondition for defense.** Linters (D7) and access-matrix snapshots (D6) can
  only exist because grants are structured data. Every escape into freeform predicates removes the
  metadata from the reach of every automated defense we have. This is also the standing answer to
  "why not raw RBAC + RLS" — see *Alternatives considered*.

### The `role` collision

"Role" is the single most overloaded word in access control — four incompatible industry readings,
each with a large constituency:

| Constituency | What "role" means there | Our equivalent |
|---|---|---|
| Kubernetes / ServiceNow / Dataverse | capability container | permission set |
| Salesforce | **visibility hierarchy** (no capability at all) | business unit |
| AWS IAM | assumable identity | (no equivalent) |
| better-auth / generic SaaS | org-administration tier (owner/admin/member) | `sys_member.role` |

Meanwhile the codebase itself has three: `sys_role` (job-role bundle per ADR-0057 D5),
`sys_member.role` (org administration), and `ctx.roles[]`. No spelling of "role" can be
chosen that does not mislead at least two constituencies. The resolution is not to pick a winner but
to **remove the word** (D3).

### What mature kernels converge on

Surveying Salesforce, Dataverse, ServiceNow, SAP, NetSuite, Odoo, Frappe, and modern IAM
(policy/ReBAC systems), three invariants hold everywhere the model aged well:

1. **Capability and visibility are separate axes** (what you can do vs whose records).
2. **Users never hold capability directly** — a flat grouping layer distributes it
   (SNOW groups, SAP composite roles, Salesforce PSGs). That layer is our *position*.
3. **Nobody keeps two hierarchies.** Systems with parallel org trees (early Salesforce role tree +
   territories) universally regret it. ADR-0057 already chose the BU tree; D3 finishes the job.

The negative example is Dataverse **owner teams** (may own records *and* carry security roles):
powerful, and the single most-complained-about auditability feature in that ecosystem. D8 codifies
the opposite stance while our teams are still flat.

---

## Decision

### D1 — Custom objects default to OWD `private`

`effectiveSharingModel()` (`packages/plugins/plugin-sharing/src/sharing-service.ts`) today collapses
"no `sharingModel` declared" to **public** — full-tenant read/write for anyone with an object-level
grant. That default inverts the admin's mental model and produced the objectui#2348 incident.

- A **custom object** (non-`sys_*`, not platform-managed) with no `sharingModel` now resolves to
  **`private`**.
- Authoring/publish of a *new* custom object **requires** an explicit `sharingModel` (the Studio UI
  already surfaces the control and an unset-warning as of objectui#2348; the spec gate makes it
  mandatory rather than advisory).
- **Existing metadata is grandfathered by stamping, not by behavior**: a migration pass stamps
  current OWD-less custom objects with an explicit `sharingModel: 'public_read_write'` + a publish
  warning, so nothing silently changes behavior on upgrade — the *unset* state simply ceases to exist
  going forward.
- `sys_*` / platform objects keep their ADR-0066 posture (explicitly declared, secure-by-default).

### D2 — The Profile concept is removed

`isProfile` is deleted from `PermissionSetSchema` (`packages/spec/src/security/permission.zod.ts`)
— removed, not deprecated (launch window). Rationale, in decreasing order of weight:

1. **Package/platform isolation.** A profile is "this user's identity baseline in this customer's
   environment" — inherently environment-owned. A package shipping profiles claims ownership of the
   customer's identity model, which is exactly the boundary ADR-0086 D3 made machine-checkable.
   Upgrade semantics ("does the package overwrite the customer's edited profile?") are unresolvable
   by construction.
2. **The runtime never consumed it.** `permission-evaluator.ts` merges all sets most-permissively
   regardless; `isProfile`'s only consumers are a fallback-selection helper and a UI badge.
3. **Learning cost.** The concept is free only for Salesforce-trained admins — and Salesforce itself
   is retiring profiles (permission-set-first). A pure-additive model teaches in one sentence.

`isDefault` **survives with narrowed semantics**: a package-authored *suggestion* consumed once at
install time (D5), never a runtime fallback. ADR-0056 D7's fallback mechanism
(`appDefaultProfileName`, `fallbackPermissionSet`) is superseded by D5.

UI consequence (ObjectUI): the profile badge/toggle in the permission matrix is removed; in its place
surface the two flags that actually matter — **provenance** (📦 package / ✏️ environment, from
ADR-0086 D3 `managedBy`/`packageId`) and **default** (bound to the `everyone` position).

### D3 — `role` → `position`; "role" becomes a reserved-forbidden word

One-step renames (no aliases — supersedes ADR-0057 D7's alias clause for these):

| Current | New |
|---|---|
| `sys_role` | `sys_position` |
| `sys_user_role` | `sys_user_position` |
| `sys_role_permission_set` | `sys_position_permission_set` |
| `ctx.roles[]` (ExecutionContext) | `ctx.positions[]` |
| `current_user.role` (RLS variable) | `current_user.position` |
| `RoleSchema` / `identity/role.zod.ts` | `PositionSchema` / `identity/position.zod.ts` |
| `role-graph.ts` (flat expansion only, per 0057 D5) | `position-graph.ts` |
| sharing recipient `'role'` | `'position'` |
| sharing recipient `'role_and_subordinates'` | **removed** — `unit_and_subordinates` is canonical (0057 D5); the deprecated alias is not shipped |

`PositionSchema` carries **no `parent`** field: ADR-0057 D5 already ruled the visibility hierarchy
does not live here (the old `parent` walk queried a column that never existed). Positions are flat.

Why `position` (and not `group`, `persona`, or keeping `role`): it is the exact translation of the
enterprise-HR term (岗位), matches SAP HCM structural authorizations and Dynamics hierarchy-security
vocabulary, collides with nothing in-system (`group` is a sharing recipient; teams exist), and leaves
the correct seam for a future HR module where the permission position and the HR position are the
same entity.

**Word ban.** "role" is a reserved-forbidden word in identifiers, UI copy, and documentation,
enforced by lint. Single documented exception: the better-auth boundary — `sys_member.role` is
third-party schema we do not own; it remains, already relabelled `org_membership_level` in the
platform projection (ADR-0057 D7), and its UI label is "organization membership", never "role".
The naming commandment, for humans and AI alike:
**capability = `permission_set` · distribution = `position` · hierarchy = `business_unit` ·
collaboration = `team`. The word "role" does not exist here.**

`permission_set` is deliberately **not** renamed — see *Alternatives considered*.

### D4 — OWD vocabulary: canonical four, aliases removed

The `sharingModel` enum shrinks to `private | public_read | public_read_write |
controlled_by_parent`. The legacy aliases `read`, `read_write`, `full` are **removed from the zod
enum** — authoring rejects them with a fix-it message; no lenient parse, no normalization layer.
(Contract-first: producers are fixed, renderers/evaluators never learn dialects. The alias
normalization ObjectUI shipped defensively in objectui#2348 becomes dead code and is removed there.)
The grandfathering pass in D1 rewrites any stored alias to its canonical value.

### D5 — The built-in `everyone` position carries default grants

Replaces both the `member_default` builtin-set fallback and ADR-0056 D7's default-profile flag as
*mechanisms* (the flag survives as a suggestion, below).

- A built-in, undeletable position **`everyone`**; every authenticated org member is implicitly a
  member. "What do new users get" ≡ "what is bound to `everyone`" — same tables
  (`sys_position_permission_set`), same UI, same audit path, same explain path as every other grant.
  **No second distribution channel** (an env-level `defaultPermissionSets` setting was considered
  and rejected — see Alternatives).
- **Resolved per-request, never materialized** per user: binding a newly installed package's
  self-service set applies to existing users on their next request; uninstalling the package
  (removing its sets by `packageId`, ADR-0086 D3) revokes it everywhere at once. No ghost grants.
- **The fallback cliff is abolished.** Today's semantics ("fallback applies only while the user has
  *zero* explicit grants") mean the first real grant silently *removes* the user's baseline.
  `everyone` is additive like any other position: baseline ∪ explicit, always.
- **Packages suggest, admins confirm.** `isDefault: true` on a package permission set produces an
  install-time prompt ("CRM suggests adding `crm_readonly` to Everyone — accept?"). It is **never**
  auto-bound: installing a package must not silently widen every tenant user's access.
- **Lint (D7) hard-blocks high-privilege bits on `everyone` bindings**: `viewAllRecords`,
  `modifyAllRecords`, `allowDelete`, `allowPurge`, `allowTransfer`, and `systemPermissions` are
  rejected (or force a break-glass confirmation) on any set bound to `everyone`.

### D6 — Explain engine is P0; access-matrix snapshots gate publishes

A contract `explain(principal, operation, object, record?) → decision + granting path` (which
set/position/OWD/share/rule produced the answer) is added to `@objectstack/spec/contracts` and
implemented across `plugin-security` + `plugin-sharing`. It is the shared engine for:

1. **The admin simulator** ("view as 张三") in Studio/Setup;
2. **The access-matrix snapshot gate**: the publish pipeline evaluates a matrix of representative
   positions × objects (operation × depth) and diffs it against the committed snapshot. Unchanged
   matrix → auto-pass. Changed matrix → the publish requires a human gate (D7) and the diff is
   presented **semantically** ("this change grants `sales_rep` (~1,200 users) org-wide read on
   `crm_opportunity`"), not as JSON.

This is the piece that turns the 9-layer evaluation pipeline from "auditable in principle" into
"explained by construction", and it is the load-bearing dependency of the AI-safety story — hence P0.

### D7 — Security-domain publish linter + tiered human gates

Metadata publishes are gated by domain:

- **Security domain** (permission sets, `sharingModel`, sharing rules, RLS policies, position
  bindings): publish requires the linter to pass **and** a human approval whose review artifact is
  the D6 semantic diff. AI may draft freely; it may not silently publish capability.
- **Non-security domain** (pages, views, layouts): may auto-publish per existing rules.

Initial linter rules (each traceable to an observed failure class; the taxonomy grows by incident):

| Rule | Origin |
|---|---|
| Custom object with unset OWD → error | objectui#2348 incident (pre-D1 metadata) |
| High-privilege bits on an `everyone`-bound set → block | D5 |
| `'*'` wildcard carrying `viewAll/modifyAll` outside a platform-admin set → error | ADR-0066 |
| OWD alias values → error with fix-it | D4 |
| The word `role` in identifiers/labels → error | D3 |
| `private` object granted `allowRead` with no `readScope` → info ("owner-only — intended?") | admin-intent mismatch class |

Per ADR-0049 discipline, a lint the runtime cannot enforce is not shipped as advisory security — it
either gates or it does not exist.

### D8 — Teams receive sharing; they never carry capability

`sys_team` (better-auth, flat — `team-graph.ts` explicitly walks no hierarchy) is confirmed as a
**sharing recipient and member-expansion group only**. Teams never own records and are never bindable
to permission sets. Positions distribute capability **vertically** (stable, org-shaped); teams
receive shared records **horizontally** (fluid, deal/project-shaped). This is a standing constraint,
lint-checked at the spec level (no `team_id` on `sys_position_permission_set`-like tables), so the
Dataverse owner-team auditability failure mode is unrepresentable rather than discouraged.

---

## Consequences

- **Final vocabulary** (five words, one reading each):
  `permission_set` · `position` · `business_unit` · `sharing`/`sharingModel` (with `team` as
  recipient) · plus `rls` as the expert escape hatch. The complete admin mental model:
  *permissions are unions of permission sets; positions decide who gets which sets; the BU tree and
  manager chain decide how deep you see; each object's OWD sets the record baseline — sharing only
  widens, RLS only narrows.*
- **Package developers** ship objects (with mandatory OWD) + functional permission sets (+ optional
  suggested defaults). They never ship positions, BUs, teams, or assignments.
- **Admins** own the org tree, positions, bindings, and the `everyone` baseline. Restriction is done
  by *not granting* (additive model), never by authoring "subtraction sets".
- **Breaking changes** are concentrated in one pre-launch wave (P1 below); after launch the
  vocabulary is frozen by lint.
- **ObjectUI**: Access pillar relabels (Position/岗位), profile badge → provenance + default badges,
  permission matrix gains OWD context per object row; Data pillar OWD control (objectui#2348) gains
  the mandatory-on-create behavior; alias normalization removed.
- The companion reference (`docs/design/permission-model.md`) is the maintained source of truth for
  the model; `content/docs/permissions/*` is updated to match in P1–P2 as the implementation lands.

## Non-goals

- **Per-privilege depth** (Dataverse `privilege × depth`). Object-level `readScope`/`writeScope`
  (ADR-0057 D1) is a deliberate simplification; Dataverse's granularity is its adoption tax.
- **ERP dimension restrictions** (Frappe User-Permissions-style "only rows where `company_id` ∈
  my companies") as a first-class declarative concept. Today this is expressible via RLS; promoting
  it is a candidate follow-up ADR once demanded by a real deployment.
- **Renaming `permission_set`** — see below.
- Approval workflows, delegation, break-glass access: out of scope.

## Alternatives considered

1. **Rename `permission_set` → `role`** ("RBAC-orthodox"). Rejected: "role" has four incompatible
   industry readings; adopting any one of them misleads the constituencies of the other three
   (Salesforce admins read role=hierarchy, AWS engineers read role=assumable identity). The stable
   optimum is a vocabulary in which the contested word does not appear at all. `permission_set` is
   verbose but misread by no one.
2. **Keep Profile as a strong convention** (cardinality constraint "≤1 profile per user", UI
   partition). Rejected on the package/platform isolation argument (D2 #1) — the constraint polishes
   a concept whose ownership problem is unresolvable; and the industry trend (Salesforce
   permission-set-first) runs the other way.
3. **Environment-level `defaultPermissionSets` setting** instead of the `everyone` position.
   Rejected: it creates a second distribution channel outside the position system — one more place
   "why does this user have this?" must check, invisible to the explain path and the audit tables
   that positions already have.
4. **`group` / `persona` as the new name.** `group` collides with the sharing-recipient enum and IdP
   vocabulary; `persona` is meaningless to enterprise admins and has no HR-term mapping.
5. **Deprecated aliases for the renames** (ADR-0057 D7 discipline). Superseded by the launch-window
   argument: aliases now are debt with no debtor.

## Phasing (each independently shippable, proofs per ADR-0054)

- **P1 — The breaking wave** (one coordinated PR, mechanical): D3 renames, D4 enum cleanup, D2
  `isProfile` removal, D1 default flip + grandfather stamping. Regenerated translations; conformance
  matrix rows updated. Proof: full test suite + a dogfood re-run of the objectui#2348 scenario
  showing owner isolation with *no* explicit OWD authored.
- **P2 — `everyone` position** (D5): builtin seeding, install-time suggestion prompt, cliff removal.
  Proof: package install/uninstall grant-liveness e2e.
- **P3 — Linter + tiered gates** (D7): publish-pipeline integration. Proof: each lint rule has a
  fixture that fails without it.
- **P4 — Explain + matrix gate** (D6): contract, engine, simulator UI, snapshot gate. Proof: matrix
  snapshot diff drill on a seeded CRM stack.

## References

- ADR-0049, ADR-0056, ADR-0057 (+ its 2026-06-25 addendum), ADR-0066, ADR-0086
- objectstack-ai/objectui#2348 — OWD control in Studio + the dogfood incident writeup
- Companion: [docs/design/permission-model.md](../design/permission-model.md)
- Industry survey (capability/visibility split, distribution layers, hierarchy convergence):
  Salesforce sharing architecture, Microsoft Dataverse security model, ServiceNow ACL/groups,
  SAP PFCG/structural authorizations, Odoo groups/record rules, Frappe user permissions,
  AWS IAM policy simulator (explainability prior art).

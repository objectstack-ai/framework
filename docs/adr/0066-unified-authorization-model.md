# ADR-0066: Unified authorization model — capability registry, secure-by-default posture, resource→capability contracts, dual-surface gates

**Status**: Proposed (2026-06-23)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0057](./0057-erp-authorization-core-business-units-and-scope-depth.md) (`readScope`/`writeScope` depth: own/unit/unit_and_below/org), [ADR-0058](./0058-expression-and-predicate-surface.md) (CEL predicate surface used by RLS); relates to cloud ADR-0016 (authz open/paid boundary)
**Consumers**: `@objectstack/spec` (object/app/permission schemas), `@objectstack/plugin-security` (RLS/FLS compiler + enforcement), `../objectui` (ActionRunner + app/nav gating), `../cloud` (control-plane objects, e.g. `sys_license`)

**Premise**: pre-launch — specify the target end-state. This ADR is a *consolidation*: it names the layers the platform already has, then fills four gaps with minimal additions that reuse existing vocabulary. Every item below is tagged **[existing]** or **[new]**.

> **Trigger**: `sys_license` (cloud) needed "platform-admin-only + platform-global, secret token" and there was no clean way to express it. Investigation showed this is not a one-off: the platform can declare RLS/grants only on **global permission sets** (which can't reference a tenant-private or package-private object), objects are **allow-by-default** (wildcard `'*': {allowRead:true}`), capabilities are **strings** (not maintainable records), and action gating is **per-surface** (UI predicate + a separate server check). These are general gaps.

## The three-way separation (principle)

Authorization splits into three concerns that must stay decoupled:

1. **Capability** — *what can be done* (`manage_users`, `manage_licenses`, `export_data`, `approve_invoice`). **Defined** by the platform/package, **extended** by admins.
2. **Assignment** — *who holds a capability* — permission sets / roles / user bindings. **Maintained by admins at runtime.** **[existing]** `sys_permission_set`, `sys_role`, `sys_user_permission_set`, `sys_role_permission_set` are runtime records edited in Setup.
3. **Requirement** — *what a resource needs* — an object / field / action / app **references** a capability (a contract). It does **not** encode the assignment.

The design rule that resolves the recurring confusion: **a resource declares the capability it requires (a stable contract); the capability and its assignment are dynamic, admin-maintained records.** A resource never bakes "who" — only "what is required".

## Authorization needs (taxonomy: need × status)

| # | Need | Status |
|---|---|---|
| 1 | Object CRUD (read/create/update/delete an object type) | **[existing]** permission-set `objects:{allowRead/Create/Edit/Delete}` |
| 2 | Field-level security (FLS) | **[existing, partial]** permission-set field rules |
| 3 | Row-level security: ownership (`created_by`), hierarchy (own/unit/unit_and_below/own_and_reports), org/tenant isolation, explicit sharing, CEL predicates | **[existing]** RLS compiler + ADR-0057 depth + `tenant_isolation` wildcard + sharing |
| 4 | System/functional capabilities (`manage_*`, `approve`, `export`, `issue_license`) | **[existing, as strings]** `systemPermissions` — **gap: not first-class records** |
| 5 | App / nav / page surface access | **[existing]** `App.requiredPermissions` |
| 6 | Action/button gating, enforced on **both** UI and server | **[existing, per-surface]** UI `visible`/`disabled` CEL + ad-hoc server checks — **gap: no single declaration gating both** |
| 7 | Tenancy posture (tenant-scoped vs platform-global) | **[existing]** `tenancy.enabled` |
| 8 | Default exposure posture (public-by-default vs private/deny-by-default) | **gap** — wildcard `'*':{allowRead:true}` makes every object readable by default |
| 9 | Admin tiers: platform / org / delegated | **[existing]** `admin_full_access` / `organization_admin`; delegated = future |
| 10 | Dynamic, runtime-maintained assignment | **[existing]** Setup over the RBAC records |
| 11 | Package ships secure defaults, admin-maintainable after | **[existing, partial]** `stack.permissions` seeds permission sets — **gap: per-object secure default for a package's own object** |
| 12 | Combination semantics (grants union/most-permissive; explicit deny) | **[existing]** union |
| 13 | Anti-escalation (org admin can't self-grant platform admin) | **[existing]** RBAC tables read-only for `organization_admin` |

## Decisions (four additions, each reuses existing vocabulary)

### D1 — Capability registry [new]
Promote capabilities from bare strings to **first-class records** (`sys_permission` / capability definition) with `name`, `label`, `description`, `scope` (platform | org), and a `managedBy` (platform | package | admin). `systemPermissions[]` on permission sets and `requiredPermissions[]` on resources become **references** to these records. Packages declare their capabilities; admins add new ones in Setup. Back-compat: existing string capabilities are seeded as records with the same `name`, so all current references keep resolving.

### D2 — Secure-by-default object/field posture [new] (data-model posture, NOT a permission)
Add an object (and field) flag that opts it **out of blanket wildcard grants** — e.g. `access: { default: 'private' }` (vs the implicit `'public'`). A `private` object is **not** covered by `'*': {allowRead:true}`; access requires an **explicit** permission-set grant. Mirrors Salesforce "new object = no access until granted." This is a posture like `tenancy`, declared on the object — it is **not** an assignment and names no principal. `admin_full_access` (the superuser `'*'` grant) still covers private objects unless it too is excluded (rare).

### D3 — Resource→capability requirement [existing concept, new placement]
Extend `requiredPermissions` (today only on `App`/nav, **[existing]**) to **Object**, **Field**, and **Action**. A resource references the capability (D1) needed to access/invoke it — a contract, not an assignment. The security engine enforces it alongside permission-set grants. sys_license becomes: `access:{default:'private'}` + `requiredPermissions:['manage_licenses']`.

### D4 — Dual-surface action gates [new]
An action declaring `requiredPermissions` is enforced in **one place, two surfaces**: the ActionRunner hides/disables it in the UI **and** the server rejects the call when the caller lacks the capability. Removes the "UI-gated but server-open" footgun (and the inverse). Server enforcement is the source of truth; UI gating is derived from the same declaration.

### D5 — Package-seeded, admin-maintainable policies [existing mechanism, fill the gap]
A package may seed permission-set policies (incl. per-object grants for **its own** objects) via `stack.permissions` **[existing]**; these land as `sys_permission_set` records **admins can edit in Setup** **[existing]**. The gap to close: make a package's per-object secure default (D2 + an admin-only grant) expressible + seedable so a sensitive package object is locked on install and tunable thereafter.

## What stays unchanged (existing strengths)
Permission sets / roles / bindings as runtime records (assignment layer); the full RLS spectrum (ownership, hierarchy depth ADR-0057, tenant isolation, sharing, CEL); `tenancy`; `App.requiredPermissions`; anti-escalation; union grant semantics.

## Worked example — `sys_license` (cloud)
```ts
ObjectSchema.create({
  name: 'sys_license',
  tenancy: { enabled: false },              // [existing] platform-global (no org-RLS)
  access:  { default: 'private' },          // [new D2] not covered by wildcard grants
  requiredPermissions: ['manage_licenses'], // [new D3] references a capability (D1)
  fields: { signed_token: { /* [new D3 field] requiredPermissions: ['manage_licenses'] */ } },
  actions: [{ name: 'issue_and_sign', requiredPermissions: ['manage_licenses'], /* [new D4] UI+server */ }],
});
```
Cloud seeds (D5): `manage_licenses` capability + an `admin_full_access` grant. Result: platform-global, secret token, super-admin-only — and admins maintain who holds `manage_licenses` at runtime.

## Phasing
1. **D2 + D3 (object)** — the minimal unblock: `access:{default}` posture + object `requiredPermissions` + engine enforcement. (Lets sys_license and any sensitive object be expressed correctly.)
2. **D4** — action dual-surface gating.
3. **D1** — capability registry (string→record), back-compat seeded.
4. **D3 (field) + D5** — field-level requirements + package secure-default seeding; delegated admin (#9).

## Open-core boundary
All of this is **open mechanism** (framework `spec` + `plugin-security`): schema fields, the registry, the enforcement engine. The *policies* (which capabilities, which grants) are **data** — shipped by distributions/packages and maintained by admins. No commercial policy is encoded in the framework.

## Consequences
- **+** Security becomes declarative metadata co-located with the resource (single source of truth); generalizes to every object + third-party app; capabilities are admin-extensible records; sensitive resources are secure-by-default.
- **−** Migration: string capabilities → records (seeded, back-compat); a `private` default flips the implicit allow-by-default for objects that adopt it (opt-in, no forced migration).
- **−** Combination edge cases (explicit deny vs union) need a defined precedence; specify deny-overrides only where a resource is `private`.

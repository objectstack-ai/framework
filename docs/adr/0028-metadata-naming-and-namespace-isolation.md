# ADR-0028: Metadata Naming & Namespace Isolation — Derived Physical Names, Namespace-Scoped Identity, and a Single Kernel Contract

**Status**: Proposed (2026-06-01)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0004](./0004-object-namespace-prefix.md) (object namespace prefix — *this ADR supersedes its hand-written-literal authoring rule*), [ADR-0005](./0005-metadata-customization-overlay.md) (one Zod source per type, org overlay), [ADR-0008](./0008-metadata-repository-and-change-log.md) (Repository · ChangeLog · Cache · Registry; `MetaRef = org/type/name`), [ADR-0010](./0010-metadata-protection-model.md) (protection model), [ADR-0019](./0019-app-as-consumer-unit.md) (app as the consumer-installable unit), [ADR-0025](./0025-plugin-package-distribution.md) (package distribution)
**Consumers**: `@objectstack/spec` (manifest + stack validators), `@objectstack/objectql` (`SchemaRegistry`, `StorageNameMapping`, ownership model), `@objectstack/plugins/driver-sql` (physical table derivation), `@objectstack/rest` + `@objectstack/api` (route + generated-surface naming), `@objectstack/services/service-automation` (connector registry), `@objectstack/services/service-ai` (tool registry), `@objectstack/platform-objects` (kernel object ownership), `@objectstack/cli` (`os validate`)

---

## TL;DR

Today only **one** of ~24 metadata kinds (`object`) is protected against
cross-package name collisions, and it is protected by the *wrong mechanism*:
authors hand-write the namespace prefix into every name (`crm_account`). Every
other kind — `flow`, `role`, `permission`, `connector`, `tool`, `webhook`,
`api`, `app`, `dashboard`, … — carries a bare machine name and collides silently
when two installed packages pick the same name (connectors literally
`logger.warn('… replaced')` and overwrite, last-wins).

This ADR replaces the hand-written prefix with the mechanism every major
metadata platform actually uses, and extends collision-freedom to **all** kinds:

1. **Namespace is an identity dimension, not a string baked into names.** Item
   identity is `(namespace, type, name)`. Authors write **short** local names
   (`task`, `send_email`); the platform owns the namespace.
2. **Physical names are derived, never authored.** The storage driver maps
   `(namespace='todo', name='task') → table todo_task`. The prefix becomes a
   storage detail the author and the AI never see — exactly as Salesforce,
   ServiceNow, and Dataverse auto-prefix.
3. **Namespace is an addressing segment at every transport surface.** Data API
   becomes `/api/v1/data/{namespace}/{object}`; generated GraphQL/OData/SDK/MCP
   identifiers inject the namespace at generation. Uniqueness is enforced where
   it physically matters (storage tables, route table, tool registry), not on
   the authored name.
4. **Apps are sandboxed: no cross-app references.** The only legal
   cross-boundary reference is **app → kernel**. This doubles as a security
   boundary.
5. **The kernel is one unified, reserved namespace (`sys`) — one contract, but
   ownership distributed across first-party plugins.** It is the platform's
   public contract and the sole well-known import target (`sys.user`). Each
   capability plugin owns its own `sys_*` objects (auth ← `sys_user`, audit ←
   `sys_audit_log`, …) under a single-owner-**per-object** rule, rather than a
   `platform-objects` monolith owning everything. Unification is of the
   *contract*, not of the code package.

Decision on the open question (kernel = unified `sys` vs domain-partitioned
sub-namespaces): **unified `sys`**, on two independent grounds — industry
practice and the measured cross-reference graph (below).

---

## Context

### The problem

An ObjectStack instance installs many packages from the marketplace. A package
(`defineStack`) can contribute ~24 metadata collections. As install count grows,
name collisions across packages are inevitable — and they are currently
unmanaged for everything except objects.

### Current-state findings (codebase scan)

| Area | Finding | Location |
|:--|:--|:--|
| Prefix enforcement | `validateNamespacePrefix()` iterates **only `config.objects`** (`if (!ns || !config.objects) return`). The other ~23 collections are unchecked. | `spec/src/stack.zod.ts:459` |
| Authoring style | Object names are the **hand-written full literal** `crm_account`; docs explicitly forbid a `ns('task')` helper. | `spec/src/kernel/manifest.zod.ts:28-76` |
| Storage chokepoint | `StorageNameMapping.resolveTableName({name})` already exists, but is a **pass-through** (`todo_task → todo_task`, strips legacy `__`). Every SQL driver routes table names through it. | `spec/src/system/constants/system-names.ts:169`; `driver-sql/src/sql-driver.ts:610,1028` |
| Object identity | `MetaRef = (org, type, name)` and `SchemaRegistry` already model ownership + namespace. | `metadata-core/src/types.ts`; `objectql/src/registry.ts` |
| Ownership model | `own`/`extend` fully implemented: one owner enforced (`throw`), extenders merge by `priority` (owner 100, extender 200). **No package actually extends a `sys_` object today.** | `objectql/src/registry.ts:406-518`; `object.zod.ts:856-897` |
| Connector collisions | Re-registering a connector name only `logger.warn('… replaced')` then overwrites — **silent last-wins**. | `services/service-automation/src/engine.ts:441` |
| API routes | Route conflict detection exists with 4 strategies, but matches routes by **exact string** (`:id` vs `:userId` not detected). | `core/src/api-registry.ts` |
| Kernel namespace | `sys` is a **shared** namespace co-claimed by ~14 packages (`namespaceRegistry: Map<ns, Set<pkgId>>`); `RESERVED_NAMESPACES = {'base','system'}` does **not** include `sys`. | `objectql/src/registry.ts:13,346-389` |
| Kernel definitions | All `sys_*` objects are in fact **defined centrally in `platform-objects`**, even though `plugin-auth`/`service-job`/`service-settings` manifests each declare `namespace:'sys'` — ownership *declaration* is split from *definition*. | `platform-objects/src/**` |
| Boundary enforcement | "Apps may reference `sys_*` but never define them" is **documented intent only** — no validator enforces it; the `sys_` check only *exempts*, it does not *forbid*. | `manifest.zod.ts:66-70` |
| Kernel cross-refs | ~60 lookup fields across identity/audit/security/metadata/system (and `service-ai`'s `ai_conversations.user_id`) point at the **hub objects `sys_user` / `sys_organization`**. | scan, see §"Why unified" |

### How mainstream metadata/low-code platforms name things

| System | Package/app component names | Who writes the prefix | Kernel / standard objects | Kernel packageable? | Cross-scope reference |
|:--|:--|:--|:--|:--|:--|
| **Salesforce** (2GP) | `hpa__New_Field__c` | **Platform, automatically** — "you never add the namespace manually" | `Account`,`Contact`,`User` — **no prefix** | **No** (standard objects can't be packaged) | Standard objects globally referenceable |
| **ServiceNow** (scoped app) | `x_acme_app_request` (author writes `request`) | **Platform auto-prepends** `x_<co>_<app>_` | `sys_*` reserved system tables | Platform-owned | Cross-scope access is **governed** (ACL) |
| **Dataverse** (solution/publisher) | `cr8a3_animal` (author writes `animal`) | **Platform, per publisher prefix** | Microsoft standard tables — no publisher prefix | Microsoft-owned | Solution-isolated |

**Two laws every major platform follows, that ObjectStack currently violates:**

1. **The prefix is always platform-derived, never hand-authored.** ObjectStack's
   hand-written literal is the outlier. The author always writes the short name.
2. **The kernel is a reserved, single-owner, *flat* namespace that cannot be
   re-defined by packages and is the one global reference target.** None of the
   three partition the kernel into per-domain sub-namespaces.

---

## Decision

### D1 — Namespace is identity context; authored names are short

Item identity becomes the tuple `(namespace, type, name)`. `name` is unique only
within `(namespace, type)`, not globally. `defineStack` injects the manifest
`namespace` as ambient context; **authors never repeat it**. Two packages each
defining `flow send_email` are no longer in conflict — keys are
`(crm, flow, send_email)` and `(todo, flow, send_email)`.

This generalizes `MetaRef` (`org/type/name`) with a `namespace` dimension and
applies to **all** collections, not just objects.

### D2 — Physical names are derived at the storage boundary (invisible above)

Invert `StorageNameMapping.resolveTableName` from pass-through to derivation:

```ts
// before:  resolveTableName({ name: 'todo_task' }) -> 'todo_task'
// after:   resolveTableName({ namespace: 'todo', name: 'task' }) -> 'todo_task'
//          + honor an explicit physicalName/tableName override when binding
//            to a pre-existing external table (default-derive, override-allowed)
```

Column names already follow this pattern (`resolveColumnName` honors
`columnName`); tables now do too. The metadata layer — and the AI authoring it —
sees only short names everywhere object names appear (definition, view
`data.object`, dashboard, report, flow/hook references, app navigation, seed
`externalId`, translation keys, permissions, sharing).

**This is the concrete answer to the AI-hallucination concern.** The original
literal-prefix rule existed to avoid two writing styles (`task` vs `crm_task`)
that made AI guess wrong. Deriving the prefix at storage removes one style
entirely: at the authoring layer there is exactly one form (`task`). See
§"Leak-points" for the conditions that keep it airtight.

### D3 — Namespace is an addressing segment at every transport surface

The namespace must reappear **once, at each transport boundary**, as a
*structured segment*, not concatenated into a name — then be resolved away
before going deeper. One form per layer.

**Explicit routes** (add a namespace segment / qualifier):

- `/api/v1/data/{namespace}/{object}` (+ `/:id`, `/export`, `/:id/shares`, query, aggregate)
- `/api/v1/metadata/{namespace}/{type}/{name}` (`MetaRef` gains the dimension)
- reports, action/flow invocation, views/pages addressed by name
- inbound webhooks, connector invocation, job triggers — id qualified as `ns.name`

**Generated surfaces** (inject namespace at generation — *easy to miss, must be
done together*): object names are the source identifier for GraphQL types,
OData EntitySets, OpenAPI `operationId`/schema names, the client SDK, and
LLM-facing MCP tool names. Two packages' `Task` types collide unless the
generator namespaces them. Generated id = `{namespace}.{name}` (or per-namespace
schema), resolved back to `(ns, name)` at runtime.

**Resolution pipeline:** `route /data/todo/task` → handler resolves `(todo, task)`
→ driver derives physical `todo_task` → response payloads use short names.

### D4 — Apps are sandboxed: no cross-app references (security boundary)

A `type: app` package may reference its own metadata (short names) and the
kernel (qualified), but **may not reference metadata owned by another app**.
This collapses the only remaining "two writing styles" risk to a single,
allow-listed case (kernel imports) and simultaneously enforces a tenant-style
isolation boundary between marketplace apps.

### D5 — The kernel is one unified, reserved namespace (`sys`) with object ownership distributed across first-party plugins

Separate two things the current code conflates: the kernel **contract**
(namespace, reference surface, stability guarantee) and the kernel
**code ownership** (which package defines each object). The contract is
*unified*; ownership is *distributed*. The kernel object set is the platform's
**public contract** and the sole cross-boundary reference target. It is:

- **One reserved namespace** — `sys` — added to `RESERVED_NAMESPACES`. Apps
  reference it via a single well-known import (`sys.user`, `sys.organization`),
  with no per-package dependency declaration (like `std`).
- **Shared namespace, single owner *per object*.** The invariant is
  single-owner-per-object-name (already enforced: a second `own` throws), **not**
  single-owner-per-namespace. So `sys` is co-contributed by many first-party
  packages while every object name has exactly one owner — collision-safe via the
  object-level `own` check plus the install-time identifier registry (D6).
- **Object ownership follows the capability plugin** (honoring the
  microkernel/plugin-extensibility philosophy: a first-party feature is still a
  plugin that ships *its own data model + behavior*). `plugin-auth` owns
  `sys_user`/`sys_session`/`sys_organization`; `plugin-audit` owns
  `sys_audit_log`; `service-job` owns `sys_job`; `plugin-email` owns `sys_email`;
  etc. This corrects today's smell where these plugins *declare* `namespace:'sys'`
  but the objects are *defined* in the `platform-objects` monolith
  (ownership-declaration split from definition).
- **`platform-objects` is decomposed.** It shrinks to the *core-mandatory* slice
  — the hub objects everything references (`sys_user`, `sys_organization`),
  `sys_metadata`, and shared base/mixins — or dissolves into the capability
  plugins entirely, leaving at most a re-export facade. Everything optional
  (audit, jobs, email, approvals, sharing, AI, webhooks) becomes a plugin that
  owns its `sys_*` objects.
- **Hub + load-order, not centralization.** The two real forces that historically
  drove centralization are addressed without it: (1) the hub objects
  `sys_user`/`sys_organization` are declared *core-mandatory* and other plugins
  declare a `dependency` on them; (2) load order is sequenced via the existing
  `dependencies` / plugin-loading `loadOrder` so an owner registers before its
  referencers — which is exactly the plugin system's job.
- **Reference-but-not-define, enforced structurally** — `registerObject`
  rejects a `scope:'project'`/`type:'app'` package that tries to `own` (or
  define) any object in a reserved kernel namespace. The `sys_`-prefix *exemption*
  becomes a *prohibition* for apps. (Apps still `extend` kernel objects via
  `objectExtensions` — the supported, arbitrated path.)
- **Scattered quasi-kernel namespaces decided per-object** — `ai`, `mail`,
  `branding`, `prefs`, `feat`, `storage`, `knowledge`, `feature_flags`: each
  object is classified as *kernel contract* (owned by its capability plugin,
  contributing into `sys`) or *ordinary package* (prefixed, not
  app-referenceable). `nope` is deleted.

#### Why unified contract (`sys`), not domain-partitioned namespaces

(This is about the *namespace/reference surface*, independent of D5's distributed
*ownership*: ownership is per-plugin either way.)

1. **Industry:** Salesforce / ServiceNow / Dataverse all keep the kernel flat
   and single-owner; per-domain partitioning is how they split *apps*, not the
   kernel. Exposing `identity`/`audit`/`automation`/`ai` as separate imports
   leaks internal package structure into the public contract and multiplies what
   an app author / AI must memorize — the opposite of the low-code goal.
2. **Measured cross-reference graph:** ~60 kernel lookups converge on the hub
   objects `sys_user` and `sys_organization`, referenced from *every* domain
   (identity, audit, security, metadata, system, even `service-ai`). Partitioning
   would turn nearly every internal kernel reference into a cross-namespace
   qualified reference — manufacturing friction inside the kernel itself.

### D6 — Authoring & install enforcement (the two new chokepoints)

- **Author time** (`defineStack`, `os validate`): generalize
  `validateNamespacePrefix` into a *namespace-scope* validator over **all**
  collections — names must be bare short names (no `ns_` prefix, no `__`),
  references resolve within the package namespace or to a qualified
  `sys.x` / (forbidden) cross-app ref. Early failure with the exact fix string.
- **Install time** (package registry): register every
  `(namespace, type, name)` plus every derived transport key (route,
  connector id, tool name, webhook). The only true conflict left is **two
  packages claiming the same namespace** — already modeled by
  `NamespaceConflictError`. Catches binary artifacts that bypass `defineStack`.
- **Runtime registries** unify their duplicate semantics: the connector registry
  stops silently overwriting (`engine.ts:441`) and uses the same conflict policy
  as objects/routes.

---

## Leak-points that must be sealed for D2 to be airtight

The derived-prefix model only holds if the physical name never re-surfaces to
the author/AI as a second style:

1. **Raw SQL / native analytics.** `service-analytics`'s `native-sql-strategy`
   and any cube/report that can reference physical tables must go through name
   resolution — no hand-written `FROM todo_task`.
2. **External / legacy tables.** An object bound to a pre-existing fixed table
   name needs a `tableName`/`physicalName` override — derivation is the
   *default*, not mandatory (mirrors `columnName`).
3. **Cross-package references.** Within a package: short name. To the kernel:
   qualified `sys.x`. Cross-app: forbidden (D4). This is the one place a
   qualified form appears, and it is a single deterministic rule (like an
   `import`), not an arbitrary second style.
4. **Diagnostics.** Driver errors/logs will show `todo_task`; this is read-only
   and not authored, so it does not reintroduce ambiguity (cosmetic mapping only).

---

## Migration plan (phased, non-breaking until the flip)

ObjectStack object names today *are* the special case where `name == namespace +
'_' + short` and storage is a pass-through. That makes a staged migration
possible.

- **Phase 0 — Dual-read storage.** Teach `resolveTableName` to accept both
  `(namespace, short)` and a legacy already-prefixed `name`, deriving the same
  physical table. No behavior change; unblocks everything else.
- **Phase 1 — Validators (additive, warn-only).** Generalize the namespace-scope
  validator across all collections and add the install-time identifier registry,
  emitting warnings (not errors) for collisions and for hand-written prefixes.
- **Phase 2 — Kernel re-attribution & decomposition.** Move each `sys_*` object's
  ownership to its capability plugin (`plugin-auth` ← identity, `plugin-audit` ←
  audit, `service-job` ← jobs, …); designate `sys_user`/`sys_organization`/
  `sys_metadata` as core-mandatory and wire `dependencies` + `loadOrder`; shrink
  or dissolve `platform-objects`. Add `sys` to `RESERVED_NAMESPACES`; enforce the
  app-cannot-define-kernel rule (apps may still `extend`). Classify the scattered
  `ai`/`mail`/… objects; delete `nope`. Invariant throughout:
  single-owner-per-object.
- **Phase 3 — Transport segments.** Introduce `/data/{namespace}/…` routes and
  namespaced generated surfaces (GraphQL/OData/SDK/MCP) **side-by-side** with the
  current ones; deprecate the old shapes.
- **Phase 4 — Authoring flip + codemod.** Switch authoring to short names; ship a
  codemod that strips redundant `ns_` prefixes from authored metadata and
  references. Flip validators warn→error. Connector registry adopts the unified
  conflict policy.
- **Phase 5 — Remove legacy.** Drop dual-read and the legacy route/surface shapes
  after the deprecation window.

---

## Consequences

**Positive**

- Cross-package collisions for **all** metadata kinds disappear *by construction*
  (tuple identity); the problem domain collapses from "23 kinds each need
  collision handling" to "1 namespace-ownership check."
- Authoring matches the industry norm (short names, platform-derived physical
  names) and the AI-context goal; the hand-written-prefix outlier is retired.
- Connector silent-overwrite and route exact-match gaps are folded into one
  consistent conflict policy.
- The kernel becomes an explicit, enforced, single public contract; the
  reference-vs-define asymmetry is structural, not by convention.
- App-to-app isolation gives a real security boundary for marketplace packages.

**Negative / costs**

- A large, cross-cutting refactor (spec validators, registry, SQL driver,
  REST/API generators, connector + AI registries, `platform-objects`, CLI).
- Reintroduces a *qualified reference* form (`sys.x`) — the very thing ADR-0004
  avoided — but now as one deterministic, allow-listed rule rather than an
  arbitrary alternative, and only for kernel/cross-boundary refs.
- Requires a logical→physical mapping to be honored on **every** data path; any
  raw-SQL escape hatch is a correctness hazard (see Leak-points).
- Migration touches every existing package and artifact; needs the codemod and a
  deprecation window.

**Neutral / open**

- Exact qualifier syntax for kernel refs (`sys.user` vs `sys:user`) — to settle
  in implementation.
- Whether `field`-level names need any transport treatment beyond `columnName`
  (currently believed no — fields are object-scoped).
- Per-namespace GraphQL schema stitching vs type-name prefixing — generator
  detail for Phase 3.

---

## Alternatives considered

- **A. Extend the hand-written literal prefix to all 23 kinds.** Consistent and
  zero-resolver, but doubles down on the outlier authoring style, is verbose, and
  permanently welds name to physical key. Rejected as the long-term model
  (it is the current stopgap).
- **B. Pure logical scoping with no derived physical name.** Rejected for
  objects only — the database requires globally-unique table names, so objects
  still need a derived physical name (D2). Adopted for every *non-object* kind,
  where uniqueness is needed only at the transport/addressing layer (D3).
- **C. Detect-and-resolve at install time only (generalize the API-registry
  strategy).** Useful as a safety net (kept as part of D6) but insufficient
  alone — it treats the symptom and leaves runtime addressing ambiguous.
- **Kernel option (b): domain-partitioned sub-namespaces.** Rejected per
  §"Why unified".

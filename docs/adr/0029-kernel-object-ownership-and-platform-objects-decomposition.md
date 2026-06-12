# ADR-0029: Kernel Object Ownership — First-Party Capabilities as Plugins That Own Their Data, and Decomposing the `platform-objects` Monolith

**Status**: Accepted — K0/K1/K2/D7 implemented; K3 (pending ADR-0030/storage) + K4 cleanup remaining (proposed 2026-06-01 · calibrated 2026-06-12)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0003](./0003-package-as-first-class-citizen.md) (package as first-class citizen), [ADR-0019](./0019-app-as-consumer-unit.md) (app as the consumer-facing unit), [ADR-0025](./0025-plugin-package-distribution.md) (plugin package distribution + dependencies)
**Related**: [ADR-0028](./0028-metadata-naming-and-namespace-isolation.md) (metadata naming & namespace isolation) **depends on** this ADR — its D5/D6 (reserved `sys` namespace, single-owner-per-object, apps-cannot-define-kernel) assume the kernel is properly owned. This ADR is sequenced **first** and is independently valuable; ADR-0028 owns the naming model, this ADR owns kernel object *ownership*.
**Consumers**: `@objectstack/platform-objects` (decomposed), `@objectstack/plugins/plugin-auth` · `plugin-audit` · `plugin-sharing` · `plugin-approvals` · `plugin-webhooks`, `@objectstack/services/service-job` · `service-ai` · `service-settings` · `plugin-email`, `@objectstack/objectql` (`SchemaRegistry` ownership + `RESERVED_NAMESPACES`), `@objectstack/runtime` (bootstrap / load-order), `@objectstack/spec` (manifest `scope`, reserved-namespace enforcement)

---

## TL;DR

Every `sys_*` kernel object is defined in the **`platform-objects` monolith**,
even though the plugins that conceptually own them — `plugin-auth`,
`service-job`, `service-settings`, … — only declare `namespace:'sys'` in their
manifests. Ownership *declaration* is split from object *definition*: plugins are
hollowed into behavior-only shells whose data model lives elsewhere. That
contradicts the microkernel principle that a (even first-party) capability is a
plugin shipping **its own data model + behavior** as one cohesive unit.

This ADR makes first-party capabilities own their kernel objects:

1. **A first-party capability is a plugin that owns its `sys_*` objects + its
   behavior.** `plugin-auth` owns `sys_user`/`sys_session`/`sys_organization`,
   `plugin-audit` owns `sys_audit_log`, `service-job` owns `sys_job`, etc.
2. **Small core, everything else a capability plugin.** A short *core-mandatory*
   list (identity/org hub + metadata store) stays always-present; the rest
   (audit, jobs, email, approvals, sharing, AI, webhooks) becomes
   independently-installable capability plugins.
3. **`sys` is one shared, reserved namespace with single-owner *per object*** —
   not single-owner-per-namespace and not a monolith owner. The existing
   `own`/`extend` model already enforces one owner per object name.
4. **The hub problem is solved by dependencies + load-order, not by
   centralization.** `sys_user`/`sys_organization` are core-mandatory; capability
   plugins declare a `dependency` on them and the loader sequences owners before
   referencers.
5. **`platform-objects` is decomposed** — shrinks to the core-mandatory slice (or
   dissolves into the capability plugins behind a thin re-export facade).

This is **template-transparent** (apps only *reference* `sys_*`; resolution is
unchanged) and therefore the lowest-risk, independently-shippable foundation for
the larger naming refactor in ADR-0028.

---

## Context

### The problem

The codebase scan found the kernel is a monolith with split ownership:

| Finding | Evidence |
|:--|:--|
| **All `sys_*` objects are defined in `platform-objects`** — identity, audit, security, metadata, system domains. | `platform-objects/src/{identity,audit,security,metadata,system}/**` |
| Plugins **declare** `namespace:'sys'`, `scope:'system'` but **define no objects** — the data model lives in `platform-objects`. | `plugin-auth/src/manifest.ts:58-67`; `service-job`, `service-settings` manifests |
| `sys` is a **shared** namespace co-claimed by ~14 packages with no arbiter at the namespace level. | `objectql/src/registry.ts:346-389` (`namespaceRegistry: Map<ns, Set<pkgId>>`) |
| The `own`/`extend` ownership model is fully implemented: **one owner per object** (second `own` throws), extenders merge by `priority` (owner 100, extender 200). **No package extends a `sys_` object today.** | `objectql/src/registry.ts:406-518`; `object.zod.ts:856-897` |
| ~60 lookup fields converge on the **hub objects `sys_user` / `sys_organization`**, referenced from every domain (incl. `service-ai`'s `ai_conversations.user_id`). | scan |
| `RESERVED_NAMESPACES = {'base','system'}` — `sys` is **not** reserved. "Apps may reference but never define `sys_*`" is documented intent with **no enforcing validator**. | `registry.ts:13`; `manifest.zod.ts:66-70` |
| `scope: cloud\|system\|project` and `managedBy: platform\|config\|system\|append-only\|better-auth` already mark system data. | `manifest.zod.ts:133`; `object.zod.ts:354-385` |
| The **`setup` admin app is a static monolith** that hard-references every `sys_*` object as nav entries — and its own comment notes it was made static *because* the objects were centralized (the older `@objectstack/plugin-setup` that assembled it at runtime was deleted). | `platform-objects/src/apps/setup.app.ts` |
| `manifest.contributes.menus` exists in the schema but is **consumed nowhere** — a vestigial, unimplemented contribution point. No app-navigation merge / `appExtensions` analog to `objectExtensions` exists. | `manifest.zod.ts` (`contributes.menus`); no consumer found |

### How mainstream platforms structure the kernel

| System | Microkernel? | Who owns kernel/standard objects | First-party features |
|:--|:--|:--|:--|
| **VS Code** | Yes — tiny core | Core owns the editor model | **Even built-in languages ship as extensions** that own their contributions |
| **Kubernetes** | Yes — small API core | Core API objects | Capabilities added via API-extensions / CRDs + controllers (each owns its types) |
| **Salesforce** | Platform core | Standard objects owned by core, **not packageable** | Clouds (Sales/Service) ship as managed first-party units; standard objects stay core |
| **ServiceNow** | Platform core | `sys_*` base tables shipped by the platform | **Plugins** (activatable feature sets) add and own their own tables; CMDB/user stay core |

**Consensus this ADR adopts:** keep the core small; let first-party capabilities
be plugins that own their data; reserve a platform namespace for kernel objects
that packages may extend but not redefine.

---

## Decision

### D1 — A first-party capability is a plugin that owns its data *and* behavior

The unit of a capability is a plugin that ships its `sys_*` object definitions
alongside its services/hooks/flows — not a behavior shell pointing at a shared
data monolith. Ownership *declaration* (`manifest`) and object *definition*
(`*.object.ts`) live in the same package. Concretely:

| Capability plugin | Owns (`own`) |
|:--|:--|
| `plugin-auth` (or a base `plugin-identity`) | `sys_user`, `sys_session`, `sys_organization`, `sys_account`, `sys_team*`, `sys_member`, `sys_oauth_*`, `sys_two_factor`, `sys_api_key`, `sys_device_code`, `sys_jwks`, `sys_invitation`, `sys_department*`, `sys_user_preference` |
| `plugin-audit` | `sys_audit_log`, `sys_activity`, `sys_comment`, `sys_presence`, `sys_attachment`, `sys_notification` |
| `plugin-approvals` | `sys_approval_request`, `sys_approval_action` |
| `plugin-sharing` | `sys_role`, `sys_permission_set`, `sys_*_permission_set`, `sys_sharing_rule`, `sys_record_share`, `sys_share_link` |
| `service-job` | `sys_job`, `sys_job_run`, `sys_job_queue`, `sys_report_schedule` |
| `plugin-email` | `sys_email`, `sys_email_template` |
| `plugin-webhooks` | `sys_webhook`, `sys_webhook_delivery` |
| `service-ai` | `ai_*` (already owns these; folded under the contract per ADR-0028) |
| core / `plugin-metadata` | `sys_metadata*`, `sys_view_definition`, `sys_setting*`, `sys_saved_report` |

(Exact assignment of security objects — under `plugin-sharing` vs a dedicated
`plugin-rbac` — to settle in implementation.)

### D2 — Small core; everything else is a capability plugin

Split kernel objects into two tiers by a clear criterion:

- **Core-mandatory** — referenced by (almost) everything and has no meaningful
  "disabled" state: the **identity/org hub** (`sys_user`, `sys_organization`) and
  the **metadata store** (`sys_metadata*`). Always present; owned by a
  foundational base package (`plugin-identity` + core metadata) that cannot be
  uninstalled.
- **Capability** — has a coherent on/off boundary: audit, jobs, email,
  approvals, sharing, AI, webhooks. Independently installable/disablable; each
  owns its `sys_*` objects. When disabled, its objects simply aren't registered.

### D3 — `sys` is one shared, reserved namespace, single-owner *per object*

The invariant is **single-owner-per-object-name** (already enforced — a second
`own` throws), **not** single-owner-per-namespace and **not** one monolith owner.
Many first-party plugins co-contribute into the one `sys` namespace; each object
name has exactly one owner. Collision safety comes from the object-level `own`
check plus the install-time identifier registry (ADR-0028 D6). Other plugins may
`extend` a `sys_*` object (add fields/indexes via `objectExtensions`, merged by
priority) — the supported way to augment kernel objects.

### D4 — Reserve `sys`; apps reference but cannot define kernel objects

Add `sys` to `RESERVED_NAMESPACES`. Enforce structurally in `registerObject`: a
`scope:'project'` / `type:'app'` package attempting to `own`/define an object in
a reserved kernel namespace is rejected (the `sys_`-prefix *exemption* becomes a
*prohibition* for apps). Apps may still `extend` kernel objects. This converts
the documented "reference-but-not-define" intent into a real boundary.

### D5 — Hub + load-order, not centralization

The two forces that historically drove the monolith are addressed without it:

1. **Hub references** — `sys_user` / `sys_organization` are core-mandatory (D2);
   every capability plugin declares an explicit `dependency` on the base identity
   package rather than embedding the objects.
2. **Bootstrap order** — the loader sequences an object's owner to register
   before any referencer, via the existing `dependencies` + plugin-loading
   `loadOrder`. Owning a `sys_*` object is just another declared dependency edge —
   which is precisely the plugin system's job.

### D6 — Decompose `platform-objects`

`platform-objects` shrinks to the **core-mandatory** slice (identity/org hub +
metadata + shared base field-sets/mixins) — or dissolves entirely into the
capability plugins behind a thin **re-export facade** that preserves the current
import surface during migration. Shared schema fragments (audit/system field
mixins, common lookups) move to a small `platform-objects-base` (or `spec`)
module that capability plugins import, so decomposition does not duplicate them.

### D7 — Shared admin surfaces are "shell + slots"; capability plugins contribute navigation

Decomposition breaks the premise that lets the `setup` app be a static monolith
(it hard-references every `sys_*` object, and was made static *because* the
objects were centralized). The fix mirrors `own`/`extend` at the UI layer:

- The `setup` app is **owned by a base package** (revived `plugin-setup` or the
  base tier) and defines only the **shell + stable group/category anchors
  ("slots")** — `Overview`, `Apps`, `People & Org`, `Access Control`,
  `Automation`, `Security`, `Developer`, … It does **not** enumerate capability
  objects.
- Each capability plugin **contributes** its nav entries into a named slot via a
  declarative **navigation contribution** — the UI-layer analog of
  `objectExtensions`. This finally implements the vestigial
  `manifest.contributes.menus` (or a proper `appExtensions` /
  `navigationContributions` schema): `{ app: 'setup', group: 'security', items:
  [...], priority }`.
- The loader **merges contributions into the owning app by group id + priority**,
  exactly as object extenders merge (owner shell first, contributions by
  ascending priority).
- Each entry stays **gated by the existing nav fields** `requiresObject` /
  `requiredPermissions` (already in the App nav schema, e.g.
  `requiresObject: 'sys_package_installation'`). This doubles as the
  enable/disable mechanism: a disabled capability registers no objects, so its
  gated menu entries simply don't render — no dangling links.

This is the general extension point a marketplace needs anyway: any app
(third-party included) becomes navigation-extensible, not just `setup`. Scope
for this ADR is the `setup` app and first-party capability contributions;
generalizing app-extension to arbitrary apps is a follow-up. References inside
contributions follow ADR-0028's naming model (`sys.audit_log`, etc.).

### D8 — An object's i18n resources migrate with its ownership

A kernel object is more than its schema: it has **localized labels, field help,
and list-view names**. Today these live in `platform-objects` as generated
bundles (`src/apps/translations/*.objects.generated.ts`, produced by
`os i18n extract` against `scripts/i18n-extract.config.ts`, loaded at runtime by
the `platform-objects` plugin). The generated entries are keyed by **object
name** (`sys_webhook: {...}`) and loaded globally, so they keep working at
runtime regardless of which package owns the object — but their **source of
truth** stays wrongly attached to the monolith.

Therefore object migration must carry the i18n resources, not just the schema:

- The owning plugin becomes the **source of truth** for its objects'
  translations — it owns the extract config entry and ships the generated
  bundle(s), and contributes them at runtime (e.g. via `i18n.loadTranslations`
  or `manifest.translations`), exactly as `platform-objects` does today.
- When an object leaves `platform-objects`, it is removed from
  `scripts/i18n-extract.config.ts`; **regenerating before the plugin owns its
  extraction would silently drop locales** — so the plugin-side i18n extraction
  must land in the same step (or the object stays in the extract set
  transitionally, explicitly tracked).
- A plugin that currently has **no i18n infrastructure** (e.g. `plugin-webhooks`,
  whose `sys_webhook_delivery` ships inline labels only) must gain one as part of
  taking ownership of a localized object — this is real, recurring work in every
  K2 domain move and must be budgeted, not assumed free.

Pilot note: the first pilot (webhooks) moves the schema and removes the object
from the monolith extract config, but **defers building plugin-side i18n
extraction** — the existing generated entries remain valid at runtime
(object-name-keyed), and the plugin-owned i18n bundle is the explicit next sub-task
before any regeneration.

---

## Migration plan (template-transparent, independently shippable)

Apps only *reference* `sys_*`; resolution is unchanged throughout, so existing
templates are unaffected. This sequence can land **before** and independently of
the ADR-0028 naming flip.

- **K0 — Ownership model readiness.** Confirm `own`/`extend` + `dependencies` +
  `loadOrder` cover cross-package ownership with the hub dependency edges; add an
  install-time check that every `sys_*` object resolves to exactly one owner.
  *Exit:* registry resolves the full current kernel identically with explicit
  single owners; no resolution diffs.
- **K1 — Base identity + reserved namespace + setup shell.** Extract the
  core-mandatory hub (`sys_user`/`sys_organization`/`sys_metadata*`) into the
  always-present base package; add `sys` to `RESERVED_NAMESPACES`; wire dependency
  edges. Implement the **navigation-contribution mechanism** (D7) and reduce the
  `setup` app to its shell + group anchors owned by the base package; the existing
  hard-coded entries become base-package contributions for now. No capability
  object moves owner yet beyond the hub.
  *Exit:* identity/auth bootstrap green; load-order deterministic; `setup` renders
  identically, now assembled from contributions.
- **K2 — Move ownership to capability plugins (incrementally, one domain at a
  time).** For each domain (audit → jobs → email → approvals → sharing →
  webhooks), relocate the `*.object.ts` definitions into the owning plugin and
  switch its manifest from "declare `namespace:'sys'`" to actual `own`, and move
  that domain's `setup` nav entries out of the base shell into the plugin as
  navigation contributions (D7). **Migrate the object's i18n resources with it**
  (see D8). Keep a `platform-objects` re-export facade so importers don't break
  mid-migration (where the dependency direction forbids a facade — e.g. a leaf
  plugin `platform-objects` already depends on — do a clean move instead and
  update the importers).
  *Exit per domain:* that domain's objects resolve to the new owner; its setup
  menu entries render via its own contribution; its translations load from the
  owning plugin (no localization regression); its tests green; cross-domain
  lookups to the hub still resolve.
- **K3 — Boundary enforcement.** Flip the app-cannot-define-kernel check
  warn→error. Classify the scattered `ai`/`mail`/`branding`/`prefs`/`feat`/… —
  each object either folds into the kernel contract (owned by its capability
  plugin) or becomes an ordinary prefixed package. Delete `nope`.
  *Exit:* no app defines a `sys_*` object; quasi-kernel namespaces classified.
- **K4 — Remove the facade.** Once all importers reference capability plugins
  directly, drop the `platform-objects` re-export facade (or reduce
  `platform-objects` to the base slice).
  *Exit:* `platform-objects` contains only core-mandatory + shared base, or is
  gone.

---

## Consequences

**Positive**

- First-party capabilities become true plugins (data + behavior in one unit) —
  the platform "dogfoods" its own extensibility model; what ships the kernel is
  the same mechanism third parties use.
- Capabilities gain a real on/off boundary (audit/jobs/email/… can be omitted),
  shrinking minimal deployments and clarifying dependencies.
- Single-owner-per-object + reserved `sys` gives the kernel the same
  collision-safety apps already enjoy, and lays the foundation ADR-0028 needs.
- Ownership declaration and definition are reunited; the "shell plugin" smell is
  removed.

**Negative / costs**

- Non-trivial internal refactor of `platform-objects` and ~8 plugins; load-order
  and the `sys_user`/`sys_organization` hub dependency must be gotten right or
  bootstrap breaks (mitigated by K0/K1 gating + the re-export facade).
- More packages and dependency edges to maintain.
- Risk of circular dependencies if a "capability" object is over-eagerly made to
  reference another capability's object; the hub must stay in the base tier and
  cross-capability references should be minimized (or go through the hub).

**Neutral / open**

- Exact home of the security/RBAC objects (`plugin-sharing` vs `plugin-rbac`).
- Whether the base tier is a dedicated `plugin-identity` or stays inside
  `platform-objects-base`.
- Whether disabled capabilities should hard-remove their tables or leave them
  dormant (interacts with `managedBy` and uninstall semantics).
- The navigation-contribution schema (D7): revive/extend the vestigial
  `manifest.contributes.menus` vs add a first-class `appExtensions` /
  `navigationContributions` collection — and how far to generalize app-extension
  beyond the `setup` app (arbitrary third-party apps) in this ADR vs a follow-up.

---

## Alternatives considered

- **Keep the monolith (`platform-objects` owns all).** Simplest, no load-order
  work, but perpetuates the shell-plugin smell and the namespace-without-arbiter
  fragility; rejected as the long-term shape (it is the historical artifact this
  ADR addresses).
- **One owner, others `extend`.** `platform-objects` keeps `own`ership and
  capability plugins only add fields via `objectExtensions`. Preserves a single
  definition site but still hollows the plugins (they own behavior, not their
  core data) — a half-measure; rejected in favor of true per-capability
  ownership.
- **Per-domain sub-namespaces (`identity`, `audit`, …) instead of one `sys`.**
  This is a *naming/reference-surface* question owned by ADR-0028 (rejected there
  on industry practice + the hub cross-reference graph). Ownership distribution
  (this ADR) is orthogonal and does not require sub-namespaces.

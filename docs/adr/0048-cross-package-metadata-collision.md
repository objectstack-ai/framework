# ADR-0048: Cross-package metadata collision — package-id identity, namespace install gate, package-scoped resolution

**Status**: Revised (2026-06-13) — supersedes the original *per-item collision
detection* framing. The runtime guard shipped under the original proposal is
**retained as a same-package authoring backstop**; the strategic direction for
the app-marketplace era is revised below.
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0003](./0003-package-as-first-class-citizen.md) (package as first-class citizen), [ADR-0005](./0005-metadata-customization-overlay.md) (artifact vs runtime overlay precedence), [ADR-0008](./0008-metadata-repository-and-change-log.md) (metadata repository, `MetaRef` identity), [ADR-0010](./0010-metadata-protection-model.md) (package provenance / `_packageId` stamping)
**Consumers**: `@objectstack/objectql` (`SchemaRegistry.registerItem`, `ObjectQL.registerApp`, install path), `@objectstack/console` / `objectui` (routing + metadata resolution), package authors, CLI/CI install path, the app marketplace registry.
**Surfaced by**: ADR-0046 review (doc naming) → generalised to all bare-named metadata → re-examined through the app-marketplace install lens.

---

## TL;DR

The metadata registry key is `org/type/name` — it has **no package
coordinate** (`refKey` in `packages/metadata-core/src/types.ts`). Objects
dodge collisions because their names are namespace-prefixed (`crm_account`)
and map to physical tables; a clash fails **loudly** at the DB. But
**bare-named UI/automation metadata** (`page`, `dashboard`, `flow`, `app`,
`action`, `doc`) is not container-scoped at resolution time: two installed
packages that each define a `page` named `home` produce the same logical key,
and the read path **silently returns whichever package registered first**.

The original decision was *per-item collision detection* at registration time
— turn the silent shadow into a loud error. That guard shipped and **stays**
as a cheap backstop. But re-examined for an **app marketplace**, per-item
detection is the wrong terminal design: two independent vendors that both ship
a `page/home` would be *unable to coexist*, and a marketplace whose packages
can't be installed together on common names is not a marketplace.

**Revised decision.** Treat the problem as one of **identity and scoped
resolution**, not write-time clash detection:

1. **Package id is the global identity and the routing/container key.** It is
   reverse-domain (`com.acme.crm`), so the vendor is baked in — two vendors'
   CRMs (`com.acme.crm` vs `com.beta.crm`) never collide, even though both
   want the word "crm". It is URL-safe and already the platform's dependency
   identity.
2. **`namespace` stays the object prefix, enforced unique *per installation*
   at install time.** A package whose namespace is already owned by a
   *different* installed package is **refused** — making explicit and early a
   constraint the object/table layer already enforces implicitly (a duplicate
   `CREATE TABLE crm_account` fails loudly at the DB).
3. **Resolution is package-scoped, keyed on the package id.** A bare name
   resolves within the caller's package first (`getItem(type, name,
   currentPackageId?)`; items already carry `_packageId`). Because package ids
   are globally unique, two packages shipping `page/home` coexist and each
   caller resolves to its own — a cross-package clash *cannot mis-resolve* for
   any caller carrying its package id.
4. **The per-item cross-package throw retires.** Distinct packages are always
   disambiguable by package id, so what the original guard flagged as a
   collision is now the *supported* coexistence case. Same-package writes
   overwrite (idempotent reload); the `os lint` namespace-prefix rule keeps
   authoring hygiene.
5. **Namespace rename-on-install is an explicit non-goal for now** (deep
   rewrite of every object name, cross-reference, and formula). v1 is
   *refuse-on-conflict*; rename is a separate future work item.
6. **The package-id URL is transparent; a per-tenant namespace alias is an
   optional sugar** (`/apps/crm` → `com.acme.crm`), never the stored identity.

## 1. Context

### 1.1 The registry key carries no package coordinate

Metadata identity is `(org, type, name)`:

```ts
// packages/metadata-core/src/types.ts
export function refKey(ref: Pick<MetaRef, 'org' | 'type' | 'name'>): string {
  return `${ref.org}/${ref.type}/${ref.name}`;
}
```

Nothing in that key says *which package* a `system/page/home` came from. For
objects this is harmless: object names are validated against a namespace
prefix in the kernel (`validateNamespacePrefix` in
`packages/spec/src/stack.zod.ts`) because they become physical table names, so
two packages cannot both ship `account` — and if they tried, the second
`CREATE TABLE` fails **loudly** at the database.

Bare-named UI/automation metadata has no such backstop. `page`, `dashboard`,
`flow`, `app`, `action`, and (as of ADR-0046) `doc` only require
`SnakeCaseIdentifierSchema`. Two packages can each legitimately declare a
`page` named `home`.

### 1.2 The silence is in the *read*, not the write

In the objectql `SchemaRegistry`, generic (non-object) metadata is stored
under a **composite** key when a package id is present:

```ts
// packages/objectql/src/registry.ts — registerItem()
const storageKey = packageId ? `${packageId}:${baseName}` : baseName;
collection.set(storageKey, item);
```

So `crm` and `hr` both shipping `page/home` do **not** overwrite one map entry
— they sit under `crm:home` and `hr:home`. The write keeps the package
coordinate. The corruption is one layer up, at **read** time, which throws it
away:

```ts
// getItem() — returns the FIRST composite key matching `:<name>`
for (const [key, item] of collection) {
  if (key.endsWith(`:${name}`)) return item as T;
}
```

`getItem('page', 'home')` takes **no package/app context** and returns
whichever entry the `Map` iterates first — i.e. whichever package registered
first. The other package's `home` is unreachable, with no error. The frontend
mirrors this exactly: `pages.find(p => p.name === pageName)` in `objectui` is
the same first-match-wins bug over the merged list.

**The root cause is context-free resolution + a missing package coordinate in
the address — not a write conflict.**

### 1.3 Why the marketplace lens changes the answer

The original ADR optimised for "don't touch the installed base" and chose
write-time detection. Run that forward in a marketplace:

- Vendor A ships `page/home`. Vendor B ships `page/home`. They never
  coordinate — that is the definition of a marketplace.
- A tenant installs A, then B → the **second install fails** with
  `MetadataCollisionError`.

For common names (`home`, `dashboard`, `settings`, `main`, `report`) this is
frequent. *Loud failure is correct for a single-repo authoring mistake; it is
the wrong behaviour for two independent vendors.* The `warn` escape hatch only
re-introduces the silent shadow it set out to kill.

### 1.4 Two "package names" — pick the right field

| field | shape | role | collision profile |
| --- | --- | --- | --- |
| **package id** (`manifest.id`) | reverse-domain `com.acme.crm` | global identity; dependency resolution already keys on it | vendor baked in → structurally safe |
| **namespace** (`manifest.namespace`) | short snake_case `crm` | mandatory object prefix (`crm_account`); URL-pretty | "land-grab" word; **most** collision-prone |
| package display name (`manifest.name`) | "Acme CRM" | human label | n/a (not an identifier) |

`namespace` is the *worst* candidate for a global unique key — everyone wants
`crm`. `package id` is the durable identity. This split drives the decision.

### 1.5 What is *not* a collision (must keep working)

- **Same-package reload** (dev reload, idempotent install) — same owner.
- **Runtime / DB overlay (ADR-0005)** — a `sys_metadata` row overlaying a
  packaged artifact; the sanctioned override path.
- **Object ownership / extension** — `own` / `extend` via `registerObject`,
  never through this guard.
- **Navigation contributions (ADR-0029)** — `appNavContributions`, not a
  duplicate `app` registration.
- **Deliberate cross-package references** — a package referencing another's
  page/app *by qualified reference* (see §3.3).

## 2. Goals & non-goals

**Goals**
- Make two independently-authored marketplace packages **coexist** even when
  they share bare names — without either silently shadowing the other.
- Give UI/automation metadata the same collision-safety objects already enjoy,
  by reusing the package container rather than renaming every artifact.
- Keep the cheap, shipped runtime guard as a backstop for the narrow
  same-package case.
- Zero false positives on overlays, same-package reloads, objects, and nav
  contributions.

**Non-goals**
- **Namespace rename-on-install.** Out of scope for v1 (see §3.5).
- Retrofitting `namespace_`-prefix *renames* onto existing bare-named artifacts
  (`page`, `flow`, …) — the container, not the artifact name, carries the
  scope.
- Changing the `org/type/name` key shape of `sys_metadata` rows.
- Cross-**org** overlay semantics (unchanged; ADR-0005 governs them).

## 3. Decision

### 3.1 Package id is the identity and the routing/container key

The route/container coordinate for an installed package's UI is its **package
id** (`manifest.id`, reverse-domain). With the current **one-app-per-package**
invariant, the app *is* the package container:

```
/apps/<packageId>/page/home          → com.acme.crm's home
/apps/<packageId>/dashboard/sales     → that package's dashboard
```

Reverse-domain ids are URL-safe (`.` is an unreserved path character) and make
two vendors' "crm" packages structurally distinct. This aligns app routing
with the identity the platform already uses for dependency resolution
(`packageId: 'com.acme.crm'`).

> **Identity vs display.** `packageId` is the key; the human label stays in
> `app.label` / `manifest.name` (i18n). The URL is `/apps/com.acme.crm`; the
> app switcher still shows "Sales CRM".

### 3.2 Namespace is the object prefix, gated unique-per-install

`manifest.namespace` remains the mandatory object-name prefix
(`${namespace}_${shortName}`, kernel-validated). The install path **refuses**
a package whose namespace is already owned by a *different* installed package
in the same installation, with an actionable error naming both packages.

This is not new work attributable to this ADR — the object/table layer
*already* requires per-install namespace uniqueness (two packages with
namespace `crm` both try to create `crm_account` and the second fails at the
DB). The gate just makes that constraint **explicit and early** (a clean
pre-install check) instead of a half-applied install blowing up at
`CREATE TABLE`.

Note the gate is **not load-bearing for routing** under §3.1 — routing keys on
the globally-unique package id, which is correct with or without the gate
(local dev, build-time, federation). The gate serves the object/table layer
and is the basis for the optional per-tenant alias (§3.6). Reserved namespaces
(`base`, `system`, `sys`) are exempt, as today.

### 3.3 Resolution is package-scoped (prefer-local, qualify-to-cross)

`getItem`/route resolution resolves a bare name **within the current package
first**, keyed on the **package id**:

- Within `/apps/<packageId>/…`, a bare `page/home` resolves to *this
  package's* `home`. The current package id is already known from the route and
  from React context (`activeApp._packageId`), so this is a single-field
  scoping — `getItem(type, name, currentPackageId?)` — not a signature change
  at every call site. Items already carry their owner (`_packageId`, ADR-0010),
  so the match is `_packageId === currentPackageId`.
- A **deliberate cross-package reference** uses a qualified form
  (`<packageId>:<name>`) — the only place a second package's metadata is
  reachable, and it is explicit.

The disambiguation rests on the **package id being globally unique**, *not* on
the namespace gate: two packages legitimately ship `page/home`, store under
distinct composite keys (`com.acme.crm:home`, `com.acme.hr:home`), and each
caller resolves to its own package's item. **A cross-package clash on
`page/home` therefore cannot mis-resolve for any caller that carries its
package id** — which every routed UI surface does. A *context-free* read
(`getItem` with no package id) is best-effort: it returns the first match and
the caller is expected to pass the package id when it cares.

### 3.4 Per-item cross-package detection retires; same-package overwrite stays

The original proposal's per-item guard threw `MetadataCollisionError` whenever
two **different** packages registered the same `(type, name)`. Under
package-scoped resolution that is exactly the case we now *support*: package
ids are always distinct, so prefer-local always disambiguates two different
packages — there is no unresolvable cross-package clash to detect. The
cross-package **throw is retired**; two distinct packages coexist on the same
bare name by construction.

What remains is the narrow, genuinely-ambiguous case the guard still earns its
keep on: **a write with no real package provenance** (a `sys_metadata`/runtime
overlay) is governed by the ADR-0005 overlay precedence (artifact-vs-DB warning,
unchanged), and **same-package re-registration** simply overwrites (idempotent
reload). Authoring-time hygiene — an author shipping two `page/home` in one
package — stays covered by the `naming/namespace-prefix` lint in `os lint`.

### 3.5 Namespace rename-on-install is deferred (non-goal)

Renaming a colliding namespace on install would require rewriting **every**
object name (`crm_account` → `acme_account`), every cross-reference, and every
formula / view / flow that names `crm_account`. That is a deep rewrite, not a
URL change. v1 is **refuse-on-conflict** (§3.2). Rename-on-install is recorded
as future work, not part of this decision.

### 3.6 The package-id URL is transparent; a friendly alias is optional

A reverse-domain URL — `/apps/com.acme.crm/page/home` — is **self-describing**:
vendor (`acme`), product (`crm`), and surface are legible at a glance, the way
Android package names, Java FQNs, and `k8s` `namespace/name` are. For a host
that runs third-party packages this is a feature, not noise: "which package is
this page from?" is answerable from the URL alone — a trust, support, and
debugging win — and one vendor's `crm` cannot be mistaken for another's.

Its one real cost is **length**. When a short URL is wanted, a host MAY expose a
**per-tenant friendly alias** — `/apps/crm` resolving to `com.acme.crm` —
because the namespace gate (§3.2) makes the namespace unique *within a tenant*.
The alias is a tenant-local presentation convenience layered over the canonical
package-id route; it is **never** the stored identity. Canonical = package id
(robust, coordination-free); alias = namespace (pretty, tenant-scoped). The
alias is optional and out of scope for the phases below.

## 4. Consequences

- **Two vendors' packages coexist.** `com.acme.crm` and `com.beta.crm` install
  side by side; each `home` page is reachable under its own
  `/apps/<packageId>/…` container. The marketplace becomes viable for
  common-named packages.
- **Cross-package safety becomes structural, not detected.** Package-scoped
  resolution (§3.3) keyed on the unique package id means two packages never
  mis-resolve a shared bare name, so the `O(every page/dashboard/flow)`
  per-item registration scan is retired. The remaining install-time work is a
  single `O(1)`-per-package namespace check for the object/table layer (§3.2).
- **Object and UI metadata share one scope model.** The package container
  scopes both; the long-standing "objects are safe, UI metadata isn't"
  asymmetry disappears, with **zero artifact renames**.
- **A namespace land-grab is now a clear, early install error** rather than a
  `CREATE TABLE` failure mid-install or a silent first-registered-wins read.
- **Local development is unaffected** until install: a dev can use namespace
  `crm` locally; the conflict is only adjudicated when installing into an
  installation that already owns `crm`.
- No change to the `sys_metadata` key shape, the overlay model, or object/nav
  paths.

## 5. Implementation phasing

Status legend: **[done]** shipped · **[proposed]** not yet built ·
**[deferred]** out of scope here.

- **[done]** Authoring lint: `naming/namespace-prefix` in `os lint` (warns on
  non-prefixed `app`/`page`/`dashboard`/`flow`/`action`/`report`/`dataset`;
  exempts the namespace-named app per ADR-0019 and `sys_` names; warning-only).
- **[done] Phase 1 — install-time namespace gate.** `NamespaceConflictError` +
  the gate in `SchemaRegistry.installPackage` (refuses a package whose
  `manifest.namespace` is already owned by a different installed package;
  same-package reload and shareable `base`/`system`/`sys` exempt;
  `OS_METADATA_COLLISION=warn` downgrades). Tests:
  `registry-namespace-install-gate.test.ts`.
- **[done] Phase 2 (backend) — package-scoped resolution.**
  `getItem(type, name, currentPackageId?)` prefers the current package's
  composite entry, keeping ADR-0005 overlay precedence; backward compatible.
  The per-item **cross-package throw is retired** (§3.4) — two distinct
  packages coexist on the same bare name. Tests:
  `registry-prefer-local-resolution.test.ts`; the original
  `*-cross-package-collision.test.ts` are rewritten from "throws" to
  "coexists + prefer-local resolves".
- **[done] Phase 2 (frontend) — prefer-local in objectui.**
  `preferLocal(list, name, ownerPackageId)` keyed on `_packageId`, wired at the
  page/dashboard/report/header bare-name sites.
- **[proposed] Phase 2 (frontend, remaining) — package-id routing.** Move the
  `/apps/:appName` segment to the package id and select the active app by
  `_packageId` (closing the app-selection ambiguity that `appName` leaves
  open). Optional: the per-tenant namespace alias (§3.6).
- **[proposed] Phase 3 — qualified cross-package references.** Define and
  document the `<packageId>:<name>` reference form for the deliberate
  cross-package case (nav contributions, shared pages); resolution falls back
  to it after the prefer-local lookup.
- **[deferred] Phase 4 — namespace rename-on-install.** Out of scope here;
  separate ADR if/when pursued.

## 6. Notes

- The `metadata-core` repository (`refKey`, `put`) is the conceptual root of
  the missing package coordinate; its optimistic-concurrency `parentVersion`
  check already rejects a blind base-layer double-create with `ConflictError`.
  The genuinely *silent* path was the objectql `SchemaRegistry` read
  resolution — which §3.3 makes package-scoped.
- `objectui` route inventory (for Phase 2): metadata reachable by name divides
  into (a) already-safe — `object`/`view` (kernel namespace), `component`
  (`:ns/:name` segment), `doc` (ADR-0046 authoring prefix), marketplace/package
  routes (already keyed on `packageId`); (b) package-scoped via this ADR —
  `page`/`dashboard`/`report`; (c) one-off — `app` (now keyed on `packageId`);
  (d) intentionally global — `action`, Studio's `metadata/:type/:name` admin.
